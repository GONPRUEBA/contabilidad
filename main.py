import json
from datetime import datetime
from typing import List, Dict, Any

from fastapi import FastAPI, Request
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from pydantic import BaseModel

# ---------------------------------------------
# Configuración y Archivos
# ---------------------------------------------
app = FastAPI()
DATA_FILE = 'data.json'
# Se asume que el archivo index.html está dentro de la carpeta 'templates'
templates = Jinja2Templates(directory="templates")

# Modelo de datos para validar la entrada (FastAPI/Pydantic)
class MovimientoRequest(BaseModel):
    fecha: str
    asunto: str
    tipo: str
    cantidad: float 

# ---------------------------------------------
# Funciones de Gestión de Datos
# ---------------------------------------------

def load_data() -> List[Dict[str, Any]]:
    """Carga los datos del archivo JSON. Si falla, lo inicializa."""
    try:
        with open(DATA_FILE, 'r') as f:
            data = f.read()
            return json.loads(data) if data else []
    except (FileNotFoundError, json.JSONDecodeError):
        # Si el archivo no existe o está corrupto, lo creamos vacío
        with open(DATA_FILE, 'w') as f:
            f.write("[]") 
        return []

def save_data(data: List[Dict[str, Any]]):
    """Guarda la lista de datos en el archivo JSON."""
    with open(DATA_FILE, 'w') as f:
        json.dump(data, f, indent=4)

def sort_and_recalculate(data: List[Dict[str, Any]]) -> tuple[List[Dict[str, Any]], Dict[str, float]]:
    """Ordena los datos por fecha (más reciente primero) y calcula saldos."""
    
    # Ordenar por fecha (más nueva a más vieja)
    try:
        data.sort(key=lambda x: datetime.strptime(x.get('fecha', '1970-01-01'), '%Y-%m-%d'), reverse=True)
    except ValueError:
        # En caso de error de fecha, se ignora la ordenación por fecha.
        pass
        
    # Recalcular saldos (usando get() para manejar posibles errores de clave si el JSON es editado manualmente)
    saldo_banco = sum(mov.get('cantidad', 0) for mov in data if mov.get('tipo') == 'BANCO')
    saldo_cash = sum(mov.get('cantidad', 0) for mov in data if mov.get('tipo') == 'CASH')
    
    saldos = {
        'banco': round(saldo_banco, 2),
        'cash': round(saldo_cash, 2),
        'total': round(saldo_banco + saldo_cash, 2)
    }
    
    return data, saldos

# ---------------------------------------------
# Rutas de la Aplicación (API)
# ---------------------------------------------

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    """Ruta principal: Muestra la interfaz web con los datos actuales."""
    movimientos = load_data()
    movimientos_ordenados, saldos = sort_and_recalculate(movimientos)
    
    # Renderiza index.html, pasando los datos y la solicitud HTTP (FastAPI requiere 'request')
    return templates.TemplateResponse(
        "index.html",
        {"request": request, "movimientos": movimientos_ordenados, "saldos": saldos}
    )

@app.post("/guardar")
async def guardar_movimiento(movimiento: MovimientoRequest):
    """Ruta POST: Recibe el nuevo movimiento, lo guarda y devuelve los datos actualizados."""
    
    # El objeto 'movimiento' ya está validado por Pydantic/FastAPI
    movimientos = load_data()
    
    # Convertir a diccionario para guardarlo en JSON
    movimientos.append(movimiento.dict())
    save_data(movimientos)
    
    # Devolver los nuevos datos ordenados y saldos para que el JavaScript actualice la interfaz
    movimientos_ordenados, saldos = sort_and_recalculate(movimientos)
    
    return {
        'movimientos': movimientos_ordenados,
        'saldos': saldos
    }

# Para iniciar el servidor:
# uvicorn main:app --host 0.0.0.0 --port 5000