from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict, EmailStr
from typing import List, Optional, Literal
import uuid
from datetime import datetime, timezone, timedelta
from passlib.context import CryptContext
from jose import JWTError, jwt
import asyncio
import random
import google.generativeai as genai

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

JWT_SECRET_KEY = os.environ['JWT_SECRET_KEY']
JWT_ALGORITHM = os.environ['JWT_ALGORITHM']
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.environ['ACCESS_TOKEN_EXPIRE_MINUTES'])

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# ==================== MODELS ====================

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

class WaterZone(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    location: str
    sensor_count: int
    status: Literal["active", "warning", "critical"]
    current_consumption: float
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class WaterZoneCreate(BaseModel):
    name: str
    location: str
    sensor_count: int
    status: Literal["active", "warning", "critical"] = "active"
    current_consumption: float

class ConsumptionData(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    zone_id: str
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    consumption: float
    flow_rate: float
    pressure: float

class LeakAlert(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    zone_id: str
    zone_name: str
    severity: Literal["low", "medium", "high", "critical"]
    type: str
    description: str
    status: Literal["active", "acknowledged", "resolved"]
    detected_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    acoustic_signature: Optional[str] = None

class LeakAlertCreate(BaseModel):
    zone_id: str
    zone_name: str
    severity: Literal["low", "medium", "high", "critical"]
    type: str
    description: str
    status: Literal["active", "acknowledged", "resolved"] = "active"
    acoustic_signature: Optional[str] = None

class ForecastData(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    zone_id: str
    forecast_date: datetime
    predicted_consumption: float
    confidence: float
    generated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AIAnalysisRequest(BaseModel):
    zone_id: Optional[str] = None
    analysis_type: Literal["forecast", "anomaly", "recommendation"]
    time_range: Optional[str] = "24h"

class AIAnalysisResponse(BaseModel):
    analysis_type: str
    result: str
    confidence: float
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ==================== AUTH UTILITIES ====================

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password):
    return pwd_context.hash(password)

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        user_doc = await db.users.find_one({"id": user_id}, {"_id": 0, "password": 0})
        if user_doc is None:
            raise HTTPException(status_code=401, detail="User not found")
        
        if isinstance(user_doc['created_at'], str):
            user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
        
        return User(**user_doc)
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ==================== AUTH ENDPOINTS ====================

@api_router.post("/auth/register", response_model=Token)
async def register(user_input: UserCreate):
    existing_user = await db.users.find_one({"email": user_input.email})
    if existing_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_dict = user_input.model_dump()
    hashed_password = get_password_hash(user_dict.pop("password"))
    
    user_obj = User(**user_dict)
    user_doc = user_obj.model_dump()
    user_doc['created_at'] = user_doc['created_at'].isoformat()
    user_doc['password'] = hashed_password
    
    await db.users.insert_one(user_doc)
    
    access_token = create_access_token(data={"sub": user_obj.id})
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

@api_router.post("/auth/login", response_model=Token)
async def login(credentials: UserLogin):
    user_doc = await db.users.find_one({"email": credentials.email})
    if not user_doc:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    if not verify_password(credentials.password, user_doc['password']):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    user_doc.pop('password')
    user_doc.pop('_id')
    
    if isinstance(user_doc['created_at'], str):
        user_doc['created_at'] = datetime.fromisoformat(user_doc['created_at'])
    
    user_obj = User(**user_doc)
    access_token = create_access_token(data={"sub": user_obj.id})
    
    return Token(access_token=access_token, token_type="bearer", user=user_obj)

@api_router.get("/auth/me", response_model=User)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user

# ==================== WATER ZONES ====================

@api_router.get("/zones", response_model=List[WaterZone])
async def get_zones(current_user: User = Depends(get_current_user)):
    zones = await db.zones.find({}, {"_id": 0}).to_list(1000)
    for zone in zones:
        if isinstance(zone['created_at'], str):
            zone['created_at'] = datetime.fromisoformat(zone['created_at'])
    return zones

@api_router.post("/zones", response_model=WaterZone)
async def create_zone(zone_input: WaterZoneCreate, current_user: User = Depends(get_current_user)):
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    zone_obj = WaterZone(**zone_input.model_dump())
    zone_doc = zone_obj.model_dump()
    zone_doc['created_at'] = zone_doc['created_at'].isoformat()
    
    await db.zones.insert_one(zone_doc)
    return zone_obj

# ==================== DASHBOARD DATA ====================

@api_router.get("/dashboard/stats")
async def get_dashboard_stats(current_user: User = Depends(get_current_user)):
    zones = await db.zones.find({}, {"_id": 0}).to_list(1000)
    alerts = await db.leak_alerts.find({"status": "active"}, {"_id": 0}).to_list(1000)
    
    total_consumption = sum(zone.get('current_consumption', 0) for zone in zones)
    active_zones = len([z for z in zones if z.get('status') == 'active'])
    critical_alerts = len([a for a in alerts if a.get('severity') == 'critical'])
    
    return {
        "total_consumption": round(total_consumption, 2),
        "active_zones": active_zones,
        "total_zones": len(zones),
        "active_alerts": len(alerts),
        "critical_alerts": critical_alerts,
        "efficiency_score": random.randint(85, 95)
    }

@api_router.get("/dashboard/consumption-history")
async def get_consumption_history(current_user: User = Depends(get_current_user)):
    # Generate mock historical data
    history = []
    for i in range(24):
        history.append({
            "hour": f"{i:02d}:00",
            "consumption": random.uniform(800, 1200),
            "predicted": random.uniform(750, 1150)
        })
    return history

@api_router.get("/dashboard/zone-consumption")
async def get_zone_consumption(current_user: User = Depends(get_current_user)):
    zones = await db.zones.find({}, {"_id": 0}).to_list(1000)
    return [{"name": z.get('name', 'Unknown'), "value": z.get('current_consumption', 0)} for z in zones]

# ==================== LEAK DETECTION ====================

@api_router.get("/leaks", response_model=List[LeakAlert])
async def get_leak_alerts(status: Optional[str] = None, current_user: User = Depends(get_current_user)):
    query = {"status": status} if status else {}
    alerts = await db.leak_alerts.find(query, {"_id": 0}).sort("detected_at", -1).to_list(1000)
    
    for alert in alerts:
        if isinstance(alert['detected_at'], str):
            alert['detected_at'] = datetime.fromisoformat(alert['detected_at'])
    
    return alerts

@api_router.post("/leaks", response_model=LeakAlert)
async def create_leak_alert(alert_input: LeakAlertCreate, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["admin", "operator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    alert_obj = LeakAlert(**alert_input.model_dump())
    alert_doc = alert_obj.model_dump()
    alert_doc['detected_at'] = alert_doc['detected_at'].isoformat()
    
    await db.leak_alerts.insert_one(alert_doc)
    return alert_obj

@api_router.patch("/leaks/{leak_id}/status")
async def update_leak_status(leak_id: str, status: str, current_user: User = Depends(get_current_user)):
    if current_user.role not in ["admin", "operator"]:
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    
    result = await db.leak_alerts.update_one(
        {"id": leak_id},
        {"$set": {"status": status}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"message": "Status updated", "leak_id": leak_id, "new_status": status}

# ==================== AI FORECASTING ====================


@api_router.post("/ai/analyze", response_model=AIAnalysisResponse)
async def ai_analysis(request: AIAnalysisRequest, current_user: User = Depends(get_current_user)):
    try:
        # Configure Gemini
        genai.configure(api_key=os.environ.get('GEMINI_API_KEY'))
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        zones = await db.zones.find({}, {"_id": 0}).to_list(1000)
        zone_data = "\n".join([f"{z.get('name', 'Unknown')}: {z.get('current_consumption', 0)} m³/h" for z in zones])
        
        if request.analysis_type == "forecast":
            prompt = f"""Based on the following water consumption data, provide a brief forecast for the next 24 hours:
{zone_data}

Provide a concise forecast with predicted consumption trends and any potential concerns."""
        elif request.analysis_type == "anomaly":
            prompt = f"""Analyze the following water consumption data for anomalies:
{zone_data}

Identify any unusual patterns or potential issues."""
        else:
            prompt = f"""Based on the following water consumption data:
{zone_data}

Provide 3 actionable recommendations for water conservation and efficiency improvement."""
        
        # Generate AI response
        response = model.generate_content(prompt)
        
        return AIAnalysisResponse(
            analysis_type=request.analysis_type,
            result=response.text,
            confidence=random.uniform(0.85, 0.98)
        )
    except Exception as e:
        logging.error(f"AI Analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")

@api_router.get("/forecasts")
async def get_forecasts(zone_id: Optional[str] = None, current_user: User = Depends(get_current_user)):
    # Generate mock forecast data
    forecasts = []
    for i in range(7):
        forecasts.append({
            "date": (datetime.now(timezone.utc) + timedelta(days=i)).strftime("%Y-%m-%d"),
            "predicted": random.uniform(18000, 25000),
            "lower_bound": random.uniform(16000, 18000),
            "upper_bound": random.uniform(25000, 28000)
        })
    return forecasts

# ==================== ANALYTICS ====================

@api_router.get("/analytics/heatmap")
async def get_heatmap_data(current_user: User = Depends(get_current_user)):
    zones = await db.zones.find({}, {"_id": 0}).to_list(1000)
    return [{
        "zone": z.get('name', 'Unknown'),
        "consumption": z.get('current_consumption', 0),
        "efficiency": random.uniform(70, 95),
        "leak_risk": random.uniform(0, 30)
    } for z in zones]

@api_router.get("/analytics/trends")
async def get_trends(period: str = "week", current_user: User = Depends(get_current_user)):
    days = 7 if period == "week" else 30
    trends = []
    for i in range(days):
        trends.append({
            "date": (datetime.now(timezone.utc) - timedelta(days=days-i)).strftime("%Y-%m-%d"),
            "consumption": random.uniform(18000, 25000),
            "leaks_detected": random.randint(0, 5)
        })
    return trends

# ==================== NOTIFICATIONS ====================

@api_router.get("/notifications")
async def get_notifications(current_user: User = Depends(get_current_user)):
    alerts = await db.leak_alerts.find({"status": "active"}, {"_id": 0}).sort("detected_at", -1).limit(10).to_list(10)
    
    notifications = []
    for alert in alerts:
        notifications.append({
            "id": alert.get('id'),
            "type": "leak_alert",
            "title": f"{alert.get('severity', 'Unknown').upper()} Leak Detected",
            "message": f"{alert.get('description', 'No description')} in {alert.get('zone_name', 'Unknown Zone')}",
            "timestamp": alert.get('detected_at'),
            "severity": alert.get('severity', 'low')
        })
    
    return notifications

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()

@app.on_event("startup")
async def init_demo_data():
    """Initialize demo data if database is empty"""
    try:
        # Check if zones exist
        existing_zones = await db.zones.count_documents({})
        if existing_zones == 0:
            # Create demo zones
            demo_zones = [
                {"id": str(uuid.uuid4()), "name": "Zone A - Downtown", "location": "Central District", "sensor_count": 12, "status": "active", "current_consumption": 1250.5, "created_at": datetime.now(timezone.utc).isoformat()},
                {"id": str(uuid.uuid4()), "name": "Zone B - Industrial", "location": "East Sector", "sensor_count": 8, "status": "warning", "current_consumption": 2100.3, "created_at": datetime.now(timezone.utc).isoformat()},
                {"id": str(uuid.uuid4()), "name": "Zone C - Residential", "location": "North Area", "sensor_count": 15, "status": "active", "current_consumption": 980.2, "created_at": datetime.now(timezone.utc).isoformat()},
                {"id": str(uuid.uuid4()), "name": "Zone D - Commercial", "location": "West Plaza", "sensor_count": 10, "status": "active", "current_consumption": 1450.8, "created_at": datetime.now(timezone.utc).isoformat()}
            ]
            await db.zones.insert_many(demo_zones)
            
            # Create demo alerts
            demo_alerts = [
                {"id": str(uuid.uuid4()), "zone_id": demo_zones[1]['id'], "zone_name": "Zone B - Industrial", "severity": "high", "type": "Pipe Leak", "description": "Acoustic signature indicates pipe leak at junction B-7", "status": "active", "detected_at": datetime.now(timezone.utc).isoformat(), "acoustic_signature": "FFT-2450Hz-Peak"},
                {"id": str(uuid.uuid4()), "zone_id": demo_zones[0]['id'], "zone_name": "Zone A - Downtown", "severity": "medium", "type": "Flow Anomaly", "description": "Unusual consumption pattern detected during off-peak hours", "status": "active", "detected_at": (datetime.now(timezone.utc) - timedelta(hours=2)).isoformat()}
            ]
            await db.leak_alerts.insert_many(demo_alerts)
            
            logger.info("Demo data initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing demo data: {str(e)}")