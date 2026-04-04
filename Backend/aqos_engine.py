import csv
import os
import random
import threading
import time
import requests
import joblib
import numpy as np
from datetime import datetime
from collections import deque
from typing import Dict, Optional, List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# --- Safely Import TensorFlow (Fault-Tolerant to Background Installations) ---
tf_installed = False
try:
    import tensorflow as tf
    from tensorflow.keras.models import Sequential, load_model as keras_load_model
    from tensorflow.keras.layers import LSTM, Dense
    from tensorflow.keras.optimizers import Adam
    tf_installed = True
except ImportError:
    pass

from sklearn.ensemble import IsolationForest

# --- 1. Global Configurations & State ---
ZONES = ["Zone A", "Zone B", "Zone C"]
CSV_FILE = "live_data.csv"
LOCK = threading.Lock()
LSTM_MODEL_PATH = "lstm_demand.keras"
SENTINEL_MODEL_PATH = "sentinel_model.pkl"

RECENT_DATA_BUFFER = deque(maxlen=200) 
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

# Models
sentinel_model = IsolationForest(contamination=0.1, random_state=42)
is_sentinel_trained = False

lstm_model = None
is_lstm_trained = False

# --- 2. Data Models ---
class ControlRequest(BaseModel):
    zone: str
    valve_open: Optional[bool] = None
    manual_leak: Optional[bool] = None

# --- 3. Warm Start Utilities ---
def save_sentinel():
    joblib.dump(sentinel_model, SENTINEL_MODEL_PATH)

def load_models():
    global sentinel_model, is_sentinel_trained, lstm_model, is_lstm_trained
    
    # 1. Warm Start Isolation Sentinel
    if os.path.exists(SENTINEL_MODEL_PATH):
        try:
            sentinel_model = joblib.load(SENTINEL_MODEL_PATH)
            is_sentinel_trained = True
            print("--- Sentinel Model Loaded from Checkpoint ---")
        except: pass
        
    # 2. Warm Start LSTM Tensor Graph
    if tf_installed and os.path.exists(LSTM_MODEL_PATH):
        try:
            lstm_model = keras_load_model(LSTM_MODEL_PATH)
            is_lstm_trained = True
            print("--- Keras LSTM Model Loaded from Checkpoint ---")
        except: pass

def init_lstm_architecture():
    global lstm_model
    if not tf_installed: return
    model = Sequential([
        LSTM(32, activation='relu', input_shape=(30, 3)), # Window=30, Features=3 [flow, temp, humidity]
        Dense(16, activation='relu'),
        Dense(1) # Predicts float representing flow demand
    ])
    model.compile(optimizer=Adam(learning_rate=0.01), loss='mse')
    lstm_model = model

# --- 4. Weather Polling & Core Engine ---
def fetch_weather_loop():
    while True:
        try:
            # External Coordinates via Open-Meteo (No API KEY Required!)
            url = "https://api.open-meteo.com/v1/forecast?latitude=26.2183&longitude=78.1828&current=temperature_2m,relative_humidity_2m"
            r = requests.get(url, timeout=5)
            if r.status_code == 200:
                data = r.json()
                with LOCK:
                    global_weather["temp"] = data["current"]["temperature_2m"]
                    global_weather["humidity"] = data["current"]["relative_humidity_2m"]
        except Exception as e:
            print(f"Weather Fetch Error: {e}")
        time.sleep(600) # Poll every 10 min

def init_csv():
    # If the file exists but has the OLD header (without temp & humidity), delete it so it builds correctly.
    if os.path.exists(CSV_FILE):
        with open(CSV_FILE, mode='r') as f:
            header = f.readline()
            if "temp" not in header:
                f.close()
                os.remove(CSV_FILE)
                
    if not os.path.exists(CSV_FILE):
        with open(CSV_FILE, mode='w', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["timestamp", "zone", "flow", "pressure", "frequency", "temp", "humidity"])
    else:
        # Prepopulate Buffer
        try:
            with open(CSV_FILE, mode='r') as f:
                reader = csv.DictReader(f)
                for r in list(reader)[-200:]:
                    RECENT_DATA_BUFFER.append({
                        "timestamp": r["timestamp"], "zone": r["zone"], 
                        "flow": float(r["flow"]), "pressure": float(r["pressure"]), 
                        "frequency": float(r["frequency"]),
                        "temp": float(r.get("temp", 25.0)), "humidity": float(r.get("humidity", 50.0))
                    })
        except: pass

def dynamic_simulator():
    init_csv()
    iteration = 0
    while True:
        iteration += 1
        ts = datetime.now().isoformat()
        
        with LOCK:
            ctemp = global_weather["temp"]
            chumid = global_weather["humidity"]
            
        for zone in ZONES:
            with LOCK:
                v_open = system_state[zone]["valve_open"]
                m_leak = system_state[zone]["manual_leak"]
            
            # Generator Logic influenced by Weather
            if v_open:
                if m_leak:
                    flow, pressure, frequency = 85.0, 48.0, 345.0
                else:
                    weather_multiplier = (ctemp / 25.0) # Flow increases if hotter!
                    b = ZONES.index(zone) * 0.5 
                    flow = (8.0 + b + random.uniform(-0.5, 0.5)) * weather_multiplier
                    pressure = 50.0 - b + random.uniform(-2.0, 2.0)
                    frequency = 180.0 + random.uniform(-10.0, 10.0)
            else:
                flow, pressure, frequency = 0.0, 5.0, 0.0
            
            # Write to disk
            try:
                with open(CSV_FILE, mode='a', newline='') as f:
                    writer = csv.writer(f)
                    writer.writerow([ts, zone, f"{flow:.2f}", f"{pressure:.2f}", f"{frequency:.2f}", f"{ctemp:.2f}", f"{chumid:.2f}"])
                
                RECENT_DATA_BUFFER.append({
                    "timestamp": ts, "zone": zone, "flow": flow, 
                    "pressure": pressure, "frequency": frequency,
                    "temp": ctemp, "humidity": chumid
                })
            except Exception as e:
                pass
                
            # Sentinel Anomaly Check
            analyze_data(zone, flow, pressure, frequency)
            
            with LOCK:
                if system_state[zone]["alert_status"] == "CRITICAL_LEAK":
                    system_state[zone]["consecutive_leaks"] += 1
                    if system_state[zone]["consecutive_leaks"] >= 3 and system_state[zone]["valve_open"]:
                        system_state[zone]["valve_open"] = False
                        system_state[zone]["auto_mitigation_active"] = True
                        print(f"AUTONOMOUS ACTION: Valve in {zone} closed due to persistent leak.")
                else:
                    system_state[zone]["consecutive_leaks"] = 0
            
        # Periodic Re-Training Routines
        if iteration % 100 == 0:
            train_sentinel()
        if iteration % 200 == 0:
            train_lstm()
            
        time.sleep(2)

def analyze_data(zone: str, flow: float, pressure: float, freq: float):
    if not is_sentinel_trained: return
    # Require both ML anomaly detection AND physical logic bounds to prevent false positives
    prediction = sentinel_model.predict([[flow, pressure, freq]])
    if prediction[0] == -1 and (flow > 20 or freq > 220):
        with LOCK:
            system_state[zone]["alert_status"] = "CRITICAL_LEAK"
    else:
        with LOCK:
            system_state[zone]["alert_status"] = "NORMAL"

def train_sentinel():
    global is_sentinel_trained
    try:
        data = [[float(r['flow']), float(r['pressure']), float(r['frequency'])] for r in list(RECENT_DATA_BUFFER)]
        if len(data) > 50:
            sentinel_model.fit(data)
            is_sentinel_trained = True
            save_sentinel()
    except Exception as e: pass

def train_lstm():
    global is_lstm_trained
    if not tf_installed: return
    
    # We need sequences of 30. Let's pull the buffer.
    data = [[r['flow'], r['temp'], r['humidity']] for r in list(RECENT_DATA_BUFFER) if r['zone'] == 'Zone A']
    if len(data) < 35: return
    
    X, y = [], []
    # Build sliding windows
    for i in range(len(data) - 30):
        X.append(data[i:i+30])
        y.append(data[i+30][0]) # Target is the next flow
        
    X_tx = np.array(X)
    y_tx = np.array(y)
    
    try:
        if lstm_model is None:
            init_lstm_architecture()
        # Train for 5 epochs silently
        lstm_model.fit(X_tx, y_tx, epochs=5, verbose=0)
        is_lstm_trained = True
        lstm_model.save(LSTM_MODEL_PATH)
        print("--- Keras LSTM Sequence Trained & Checkpoint Saved ---")
    except Exception as e:
        print(f"LSTM Train Error: {e}")

# Add threads to boot sequence
threading.Thread(target=fetch_weather_loop, daemon=True).start()
load_models()
threading.Thread(target=dynamic_simulator, daemon=True).start()

# --- 5. FastAPI Endpoints ---
app = FastAPI(title="AQOS Water Sustainability OS")

app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

@app.get("/stats")
def get_stats():
    with LOCK:
        data_snapshot = list(RECENT_DATA_BUFFER)
    return {
        "is_ml_active": is_sentinel_trained,
        "is_lstm_active": is_lstm_trained,
        "weather": global_weather,
        "zones": system_state,
        "data": data_snapshot
    }

@app.post("/control")
def update_control(req: ControlRequest):
    zone = req.zone
    if zone not in ZONES: raise HTTPException(status_code=400)
    with LOCK:
        if req.valve_open is not None:
            system_state[zone]["valve_open"] = req.valve_open
            if req.valve_open:
                system_state[zone]["auto_mitigation_active"] = False
        if req.manual_leak is not None: 
            system_state[zone]["manual_leak"] = req.manual_leak
    return {"status": "ok"}

@app.get("/forecast")
def get_forecast():
    """ Multivariate Keras Pipeline Endpoint """
    if not is_lstm_trained or not tf_installed:
        return {"predicted_flow": None, "stress_level": "Training LSTM Engine..."}
        
    # Get the latest 30 sequence windows globally for Zone A to push through the tensor graph
    historical = [[r['flow'], r['temp'], r['humidity']] for r in list(RECENT_DATA_BUFFER) if r['zone'] == 'Zone A'][-30:]
    
    if len(historical) < 30:
        return {"predicted_flow": None, "stress_level": "Gathering Window Data..."}
        
    # Shape Tensor to (1, 30, 3) 
    tensor_input = np.array(historical).reshape(1, 30, 3)
    predicted_val = float(lstm_model.predict(tensor_input, verbose=0)[0][0])
    
    # Heuristics for Stress based on ML Output
    stress = "Normal"
    if predicted_val > 15: stress = "Elevated"
    if predicted_val > 50: stress = "Critical Burst Expected"
    if global_weather["temp"] > 35 and predicted_val > 10:
        stress = "Weather Driven Demand Surges"
        
    return {
        "predicted_flow": round(predicted_val, 2),
        "stress_level": stress,
        "weather": global_weather
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)