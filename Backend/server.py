import os
import asyncio
import random
import logging
import threading
ml_installed = False
try:
    import joblib
    import numpy as np
    ml_installed = True
except ImportError:
    pass
import requests
import csv
from pathlib import Path
from collections import deque
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.context import CryptContext
from jose import JWTError, jwt
from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Literal
import uuid
import google.generativeai as genai
from starlette.middleware.cors import CORSMiddleware

# --- Safely Import TensorFlow ---
tf_installed = False
try:
    import tensorflow as tf
    from tensorflow.keras.models import Sequential, load_model as keras_load_model
    from tensorflow.keras.layers import LSTM, Dense
    from tensorflow.keras.optimizers import Adam
    tf_installed = True
except ImportError:
    pass

try:
    from sklearn.ensemble import IsolationForest
except ImportError:
    pass

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

JWT_SECRET_KEY = os.environ['JWT_SECRET_KEY']
JWT_ALGORITHM = os.environ['JWT_ALGORITHM']
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ['ACCESS_TOKEN_EXPIRE_MINUTES'])

app = FastAPI()
api_router = APIRouter(prefix="/api")

# --- ML ENGINE & STATE ---
ZONES = ["Zone A - Downtown", "Zone B - Industrial", "Zone C - Residential", "Zone D - Commercial"]
RECENT_DATA_BUFFER = deque(maxlen=500)
global_weather = {"temp": 25.0, "humidity": 50.0}

def init_zone_state():
    return {
        "valve_open": True,
        "manual_leak": False,
        "alert_status": "NORMAL",
        "consecutive_leaks": 0,
        "auto_mitigation_active": False
    }

system_state = {zone: init_zone_state() for zone in ZONES}

sentinel_model = IsolationForest(contamination=0.1, random_state=42) if ml_installed else None
is_sentinel_trained = False
lstm_model = None
is_lstm_trained = False

LSTM_MODEL_PATH = ROOT_DIR / "lstm_demand.keras"
SENTINEL_MODEL_PATH = ROOT_DIR / "sentinel_model.pkl"

def load_models():
    global sentinel_model, is_sentinel_trained, lstm_model, is_lstm_trained
    if os.path.exists(SENTINEL_MODEL_PATH):
        try:
            sentinel_model = joblib.load(SENTINEL_MODEL_PATH)
            is_sentinel_trained = True
        except: pass
        
    if tf_installed and os.path.exists(LSTM_MODEL_PATH):
        try:
            lstm_model = keras_load_model(LSTM_MODEL_PATH)
            is_lstm_trained = True
        except: pass

def init_lstm_architecture():
    global lstm_model
    if not tf_installed: return
    model = Sequential([
        LSTM(32, activation='relu', input_shape=(30, 3)),
        Dense(16, activation='relu'),
        Dense(1)
    ])
    model.compile(optimizer=Adam(learning_rate=0.01), loss='mse')
    lstm_model = model

async def fetch_weather_loop():
    while True:
        try:
            url = "https://api.open-meteo.com/v1/forecast?latitude=26.2183&longitude=78.1828&current=temperature_2m,relative_humidity_2m"
            r = requests.get(url, timeout=5)
            if r.status_code == 200:
                data = r.json()
                global_weather["temp"] = data["current"]["temperature_2m"]
                global_weather["humidity"] = data["current"]["relative_humidity_2m"]
        except: pass
        await asyncio.sleep(600)

def analyze_data(zone: str, flow: float, pressure: float, freq: float):
    if not is_sentinel_trained or sentinel_model is None:
        if flow > 80.0 or freq > 300.0 or system_state[zone].get("manual_leak", False):
            system_state[zone]["alert_status"] = "CRITICAL_LEAK"
        else:
            system_state[zone]["alert_status"] = "NORMAL"
        return
        
    try:
        prediction = sentinel_model.predict([[flow, pressure, freq]])
        if prediction[0] == -1 and (flow > 20 or freq > 220):
            system_state[zone]["alert_status"] = "CRITICAL_LEAK"
        else:
            system_state[zone]["alert_status"] = "NORMAL"
    except: pass

def calculate_zone_metrics(zone: str):
    flows = [r['flow'] for r in RECENT_DATA_BUFFER if r['zone'] == zone]
    pressures = [r['pressure'] for r in RECENT_DATA_BUFFER if r['zone'] == zone]
    current_flow = flows[-1] if flows else 0
    current_pressure = pressures[-1] if pressures else 5.0
    state = system_state[zone]
    
    efficiency = 100.0
    leak_risk = 5.0
    
    if not state["valve_open"]:
        efficiency = 0.0
        leak_risk = 0.0
    elif state["alert_status"] == "CRITICAL_LEAK" or state["manual_leak"]:
        efficiency -= 40.0
        leak_risk = 99.0
    else:
        if current_pressure > 40 and current_flow < 5:
            efficiency -= 15.0
            leak_risk += 15.0
        leak_risk += (state["consecutive_leaks"] * 25.0)
        efficiency -= (current_pressure * 0.1)
        
    return max(0.0, min(100.0, efficiency)), max(0.0, min(100.0, leak_risk))

def train_sentinel():
    global is_sentinel_trained
    try:
        data = [[float(r['flow']), float(r['pressure']), float(r['frequency'])] for r in list(RECENT_DATA_BUFFER)]
        if len(data) > 50:
            sentinel_model.fit(data)
            is_sentinel_trained = True
            joblib.dump(sentinel_model, SENTINEL_MODEL_PATH)
    except Exception as e: pass

def train_lstm():
    global is_lstm_trained
    if not tf_installed: return
    
    import csv
    data = []
    try:
        if os.path.exists("live_data.csv"):
            with open("live_data.csv", mode='r') as f:
                reader = csv.DictReader(f)
                for r in reader:
                    if r.get('zone') == ZONES[0]:
                        try:
                            data.append([float(r['flow']), float(r['temp']), float(r['humidity'])])
                        except: pass
    except: pass
    
    if len(data) < 50:
        data = [[r['flow'], r['temp'], r['humidity']] for r in list(RECENT_DATA_BUFFER) if r['zone'] == ZONES[0]]
        
    if len(data) < 35: return
    X, y = [], []
    for i in range(len(data) - 30):
        X.append(data[i:i+30])
        y.append(data[i+30][0])
    X_tx = np.array(X)
    y_tx = np.array(y)
    try:
        print("\n⚙️  Initiating Background LSTM Sequence Training...")
        if lstm_model is None: init_lstm_architecture()
        lstm_model.fit(X_tx, y_tx, epochs=5, verbose=0)
        is_lstm_trained = True
        lstm_model.save(LSTM_MODEL_PATH)
        print("✅  LSTM Training Complete! Neural Checkpoint Saved to Disk.")
    except Exception as e: 
        print(f"❌  LSTM Training Failed: {e}")

async def dynamic_simulator():
    iteration = 0
    while True:
        iteration += 1
        ts = datetime.now(timezone.utc).isoformat()
        
        ctemp = global_weather["temp"]
        chumid = global_weather["humidity"]
            
        for zone in ZONES:
            v_open = system_state[zone]["valve_open"]
            m_leak = system_state[zone]["manual_leak"]
            
            if v_open:
                if m_leak:
                    flow, pressure, frequency = 85.0, 48.0, 345.0
                else:
                    weather_multiplier = (ctemp / 25.0) 
                    b = ZONES.index(zone) * 0.5 
                    flow = (8.0 + b + random.uniform(-0.5, 0.5)) * weather_multiplier
                    pressure = 50.0 - b + random.uniform(-2.0, 2.0)
                    frequency = 180.0 + random.uniform(-10.0, 10.0)
            else:
                flow, pressure, frequency = 0.0, 5.0, 0.0
            
            row_data = {
                "timestamp": ts, "zone": zone, "flow": flow, 
                "pressure": pressure, "frequency": frequency,
                "temp": ctemp, "humidity": chumid
            }
            RECENT_DATA_BUFFER.append(row_data)
            
            try:
                file_exists = os.path.isfile("live_data.csv")
                with open("live_data.csv", mode='a', newline='') as f:
                    writer = csv.DictWriter(f, fieldnames=row_data.keys())
                    if not file_exists: writer.writeheader()
                    writer.writerow(row_data)
            except Exception: pass
            
            analyze_data(zone, flow, pressure, frequency)
            
            if system_state[zone]["alert_status"] == "CRITICAL_LEAK":
                system_state[zone]["consecutive_leaks"] += 1
                if system_state[zone]["consecutive_leaks"] >= 3 and system_state[zone]["valve_open"]:
                    system_state[zone]["valve_open"] = False
                    system_state[zone]["auto_mitigation_active"] = True
                    
                    # Generate DB Alert automatically!
                    doc = {
                        "id": str(uuid.uuid4()),
                        "zone_id": zone,
                        "zone_name": zone,
                        "severity": "critical",
                        "type": "Pipe Burst Anomaly",
                        "description": "Auto-mitigation engaged. Valve closed due to ML isolation forest leak signature.",
                        "status": "active",
                        "detected_at": ts,
                        "acoustic_signature": f"FFT-{int(frequency)}Hz-Peak"
                    }
                    await db.leak_alerts.insert_one(doc)
            else:
                system_state[zone]["consecutive_leaks"] = 0
                
        if iteration % 100 == 0: train_sentinel()
        if iteration % 200 == 0: train_lstm()
            
        await asyncio.sleep(2)


# --- MODELS ---
class ControlRequest(BaseModel):
    zone: str
    valve_open: Optional[bool] = None
    manual_leak: Optional[bool] = None

class UserRole(BaseModel):
    role: Literal["admin", "operator", "analyst"]

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    email: EmailStr
    name: str
    role: Literal["admin", "operator", "analyst"]
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserCreate(BaseModel):
    email: EmailStr
    name: str
    password: str
    role: Literal["admin", "operator", "analyst"] = "operator"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    user: User

class LeakAlertCreate(BaseModel):
    zone_id: str
    zone_name: str
    severity: Literal["low", "medium", "high", "critical"]
    type: str
    description: str
    status: Literal["active", "acknowledged", "resolved"] = "active"
    acoustic_signature: Optional[str] = None

class AIAnalysisRequest(BaseModel):
    zone_id: Optional[str] = None
    analysis_type: Literal["forecast", "anomaly", "recommendation"]
    time_range: Optional[str] = "24h"

# --- AUTH UTILITIES ---
def verify_password(plain_password, hashed_password): return pwd_context.verify(plain_password, hashed_password)
def get_password_hash(password): return pwd_context.hash(password)
def create_access_token(data: dict):
    to_encode = data.copy()
    to_encode.update({"exp": datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)})
    return jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None: raise HTTPException(status_code=401)
        user_doc = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if user_doc is None: raise HTTPException(status_code=401)
        if isinstance(user_doc['created_at'], str): user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
        return User(**user_doc)
    except: raise HTTPException(status_code=401)

class RoleChecker:
    def __init__(self, allowed_roles: list):
        self.allowed_roles = allowed_roles
        
    def __call__(self, current_user: User = Depends(get_current_user)):
        if current_user.role not in self.allowed_roles:
            raise HTTPException(status_code=403, detail="Operation not permitted for your role")
        return current_user

# --- ENDPOINTS ---
@api_router.post("/auth/register", response_model=Token)
async def register(user_input: UserCreate):
    if await db.users.find_one({"email": user_input.email}): raise HTTPException(status_code=400)
    user_dict = user_input.model_dump()
    user_dict['password'] = get_password_hash(user_dict.pop("password"))
    user_obj = User(**user_dict)
    doc = user_obj.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.users.insert_one(doc)
    return Token(access_token=create_access_token({"sub": user_obj.id}), token_type="bearer", user=user_obj)

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    doc = await db.users.find_one({"email": credentials.email})
    if not doc or not verify_password(credentials.password, doc['password']): raise HTTPException(status_code=401)
    doc.pop('password'); doc.pop('_id')
    if isinstance(doc['created_at'], str): doc['created_at'] = datetime.fromisoformat(doc['created_at'])
    user_obj = User(**doc)
    return Token(access_token=create_access_token({"sub": user_obj.id}), token_type="bearer", user=user_obj)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)): return current_user

@api_router.post("/control")
async def update_control(req: ControlRequest, current_user: User = Depends(RoleChecker(["admin", "operator"]))):
    zone = req.zone
    if zone not in system_state: raise HTTPException(status_code=400)
    if req.valve_open is not None:
        system_state[zone]["valve_open"] = req.valve_open
        if req.valve_open: system_state[zone]["auto_mitigation_active"] = False
    if req.manual_leak is not None: 
        system_state[zone]["manual_leak"] = req.manual_leak
    return {"status": "ok", "state": system_state[zone]}

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    total_consumption = 0
    active_zones = 0
    total_eff = 0
    calculated_eff_zones = 0
    
    for z in ZONES:
        if system_state[z]["valve_open"]: active_zones += 1
        recent_flows = [r['flow'] for r in RECENT_DATA_BUFFER if r['zone'] == z]
        if recent_flows: total_consumption += recent_flows[-1]
        eff, _ = calculate_zone_metrics(z)
        if system_state[z]["valve_open"]:
            total_eff += eff
            calculated_eff_zones += 1
            
    alerts = await db.leak_alerts.count_documents({"status": "active"})
    critical_alerts = await db.leak_alerts.count_documents({"status": "active", "severity": "critical"})
    
    overall_score = (total_eff / calculated_eff_zones) if calculated_eff_zones > 0 else 0
    
    return {
        "total_consumption": round(total_consumption, 2),
        "active_zones": active_zones,
        "total_zones": len(ZONES),
        "active_alerts": alerts,
        "critical_alerts": critical_alerts,
        "efficiency_score": round(overall_score, 1),
        "system_state": system_state
    }

@api_router.get("/dashboard/consumption-history")
async def get_consumption_history(current_user: User = Depends(get_current_user)):
    # Return last 30 flow events for the live telemetry chart
    history = []
    for r in list(RECENT_DATA_BUFFER):
        history.append({
            "timestamp": r["timestamp"].split("T")[1][:8], # HH:MM:SS
            "zone": r["zone"].split(" - ")[0],
            "consumption": r["flow"],
            "pressure": r["pressure"]
        })
    return history[-50:]

@api_router.get("/dashboard/zone-consumption")
async def get_zone_consumption(current_user: User = Depends(get_current_user)):
    result = []
    for z in ZONES:
        flows = [r['flow'] for r in RECENT_DATA_BUFFER if r['zone'] == z]
        val = flows[-1] if flows else 0
        result.append({"id": z, "name": z.split(" - ")[0], "value": round(val, 2)})
    return result

@api_router.get("/zones")
async def get_zones(current_user: User = Depends(get_current_user)):
    result = []
    for z in ZONES:
        flows = [r['flow'] for r in RECENT_DATA_BUFFER if r['zone'] == z]
        val = flows[-1] if flows else 0
        state = system_state[z]
        status = "critical" if state["alert_status"] == "CRITICAL_LEAK" else ("warning" if state["auto_mitigation_active"] else "active")
        if not state["valve_open"] and not state["auto_mitigation_active"]: status = "active"
        result.append({
            "id": z,
            "name": z,
            "location": z.split(" - ")[1] if " - " in z else "Live Network Node",
            "sensor_count": random.randint(8, 15),
            "status": status,
            "current_consumption": round(val, 2),
            "is_valve_open": state["valve_open"],
            "has_leak": state["manual_leak"]
        })
    return result

@api_router.get("/leaks")
async def get_leak_alerts(status: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {"status": status} if status else {}
    alerts = await db.leak_alerts.find(query, {"_id": 0}).sort("detected_at", -1).to_list(1000)
    return alerts

@api_router.patch("/leaks/{leak_id}/status")
async def update_leak_status(leak_id: str, status: str, current_user: User = Depends(RoleChecker(["admin", "operator"]))):
    result = await db.leak_alerts.update_one({"id": leak_id}, {"$set": {"status": status}})
    if result.modified_count == 0: raise HTTPException(status_code=404)
    return {"message": "Status updated"}

@api_router.get("/forecasts")
async def get_forecasts(zone_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    if not is_lstm_trained or not tf_installed:
        # Graceful fallback: return simulated predictions since TensorFlow isn't available
        forecasts = []
        for i in range(24):
            forecasts.append({
                "date": (datetime.now() + timedelta(hours=i)).strftime("%H:00"),
                "predicted": random.uniform(1800, 2500) if i < 12 else random.uniform(2000, 2800),
                "lower_bound": random.uniform(1600, 1800),
                "upper_bound": random.uniform(2500, 3000)
            })
        return {"forecasts": forecasts, "weather": global_weather}
        
    historical = []
    try:
        if os.path.exists("live_data.csv"):
            import csv
            with open("live_data.csv", mode='r') as f:
                reader = csv.DictReader(f)
                for r in reader:
                    if r.get('zone') == ZONES[0]:
                        try:
                            historical.append([float(r['flow']), float(r['temp']), float(r['humidity'])])
                        except: pass
    except: pass
    
    if len(historical) < 30:
        historical = [[r['flow'], r['temp'], r['humidity']] for r in list(RECENT_DATA_BUFFER) if r['zone'] == ZONES[0]]
        
    historical = historical[-30:]
    if len(historical) < 30:
        return {"forecasts": [{"date": (datetime.now() + timedelta(hours=i)).strftime("%H:00"), "predicted": 0, "lower_bound": 0, "upper_bound": 0} for i in range(24)], "weather": global_weather}
        
    current_window = np.array(historical).reshape(1, 30, 3)
    forecasts = []
    
    ctemp = global_weather.get("temp", 25.0)
    chumid = global_weather.get("humidity", 50.0)
    
    for i in range(24):
        # Predict the next hour
        predicted_val = float(lstm_model.predict(current_window, verbose=0)[0][0])
        mut = abs(predicted_val) + random.uniform(-0.5, 0.5)
        
        # Scale to match UI visualization units
        scaled_val = mut * 150
        forecasts.append({
            "date": (datetime.now() + timedelta(hours=i)).strftime("%H:00"),
            "predicted": abs(scaled_val),
            "lower_bound": abs(scaled_val * 0.9),
            "upper_bound": abs(scaled_val * 1.1)
        })
        
        # Shift window for autoregressive forecasting
        new_step = np.array([[[predicted_val, ctemp, chumid]]])
        current_window = np.append(current_window[:, 1:, :], new_step, axis=1)
        
    return {"forecasts": forecasts, "weather": {"temp": round(ctemp, 1), "humidity": round(chumid, 1)}}

@api_router.post("/ai/analyze")
async def ai_analysis(request: AIAnalysisRequest, current_user: User = Depends(get_current_user)):
    genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))
    model = genai.GenerativeModel('gemini-1.5-flash')
    
    flows = []
    for z in ZONES:
        zone_flows = [r['flow'] for r in RECENT_DATA_BUFFER if r['zone'] == z]
        if zone_flows:
            flows.append(f"{z}: {zone_flows[-1]:.2f} m3/h")
            
    try:
        res = model.generate_content(f"Water system flows: {', '.join(flows)}. Weather: {global_weather['temp']}C. Write a 2 sentence {request.analysis_type} report.")
        return {"analysis_type": request.analysis_type, "result": res.text, "confidence": 0.95}
    except:
        return {"analysis_type": request.analysis_type, "result": "AI Analysis unavailable.", "confidence": 0}

@api_router.get("/analytics/heatmap")
async def get_heatmap(current_user: User = Depends(get_current_user)):
    res = []
    for z in ZONES:
        eff, risk = calculate_zone_metrics(z)
        res.append({
            "zone": z.split(" - ")[0], 
            "consumption": 0, 
            "efficiency": eff, 
            "leak_risk": risk
        })
    return res

@api_router.get("/analytics/trends")
async def get_trends(zone: Optional[str] = None, current_user: User = Depends(get_current_user)):
    import hashlib
    trends = []
    for i in range(7):
        target_date = datetime.now(timezone.utc) - timedelta(days=7-i)
        date_str = target_date.strftime("%Y-%m-%d")
        seed_string = f"{date_str}-{zone or 'ALL'}"
        day_seed = int(hashlib.md5(seed_string.encode()).hexdigest(), 16)
        day_random = random.Random(day_seed)
        
        if zone and zone != "All Regions":
            consumption = day_random.uniform(4000, 6500)
            leaks = 1 if day_random.random() > 0.8 else 0
        else:
            consumption = day_random.uniform(18000, 25000)
            leaks = int(day_random.uniform(0, 3.99))
            
        trends.append({"date": date_str, "consumption": consumption, "leaks_detected": leaks})
    return trends

@api_router.get("/notifications")
async def get_notifications(current_user: User = Depends(get_current_user)):
    alerts = await db.leak_alerts.find({"status": "active"}, {"_id": 0}).sort("detected_at", -1).limit(10).to_list(10)
    return [{"id": a['id'], "type": "leak_alert", "title": f"Leak in {a.get('zone_name','')}", "message": a.get('description',''), "timestamp": a.get('detected_at',''), "severity": a.get('severity','low')} for a in alerts]

app.include_router(api_router)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.on_event("shutdown")
async def shutdown(): 
    client.close()

@app.on_event("startup")
async def startup():
    load_models()
    if not is_lstm_trained:
        print("\n⚠️  No existing LSTM model found. Executing instant cold-start training from initial CSV data...")
        train_lstm()
    asyncio.create_task(fetch_weather_loop())
    asyncio.create_task(dynamic_simulator())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)