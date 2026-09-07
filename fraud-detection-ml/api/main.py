from fastapi import FastAPI, HTTPException
import joblib
import pandas as pd
import os

app = FastAPI()

# rf_model = joblib.load('../models/random_forest.pkl')
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
model_package = joblib.load(
    os.path.join(BASE_DIR, 'models', 'random_forest.pkl')
)

rf_model = model_package["model"]
FEATURES = model_package["features"]
THRESHOLD = model_package["threshold"]

@app.post("/predict")
def predict(data: dict):
    df = pd.DataFrame([data])[FEATURES]
    
    risk_score = float(rf_model.predict_proba(df)[:, 1][0])
    is_fraud = risk_score >= THRESHOLD

    return {
        "risk_score": risk_score,
        "is_fraud": is_fraud
    }
   