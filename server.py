from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import hashlib
import datetime
import json
import os
import secrets

app = Flask(__name__, static_folder='../frontend', static_url_path='')
CORS(app)  # Enable CORS for all routes
PORT = 3003
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(BASE_DIR)
UPLOAD_FOLDER = os.path.join(PROJECT_ROOT, 'uploads')


USERS_FILE = os.path.join(PROJECT_ROOT, 'users.json')
LEDGER_FILE = os.path.join(PROJECT_ROOT, 'ledger.json') 
AUDIT_FILE = os.path.join(PROJECT_ROOT, 'audit_log.json')
SETTINGS_FILE = os.path.join(PROJECT_ROOT, 'hospital_settings.json')

users = {} # { username: { password, role, name, access_list: [] } }
audit_logs = [] 
hospital_settings = {"name": "General Hospital"} 

def load_data():
    global users
    if os.path.exists(USERS_FILE):
        try:
            with open(USERS_FILE, 'r') as f:
                users = json.load(f)
            print(f"[SYSTEM] Loaded {len(users)} users.")
        except:
            users = {}

    if os.path.exists(LEDGER_FILE):
        try:
            with open(LEDGER_FILE, 'r') as f:
                ledger.chain = json.load(f)
            print(f"[SYSTEM] Loaded {len(ledger.chain)} blocks.")
        except:
            ledger.chain = []

    global audit_logs
    if os.path.exists(AUDIT_FILE):
        try:
            with open(AUDIT_FILE, 'r') as f:
                audit_logs = json.load(f)
            print(f"[SYSTEM] Loaded {len(audit_logs)} audit logs.")
        except:
            audit_logs = []

    global hospital_settings
    if os.path.exists(SETTINGS_FILE):
        try:
            with open(SETTINGS_FILE, 'r') as f:
                hospital_settings = json.load(f)
            print(f"[SYSTEM] Loaded settings: {hospital_settings}")
        except:
            hospital_settings = {"name": "General Hospital"}

def save_users():
    with open(USERS_FILE, 'w') as f:
        json.dump(users, f, indent=4)

def save_audit_logs():
    with open(AUDIT_FILE, 'w') as f:
        json.dump(audit_logs, f, indent=4)

def save_settings():
    with open(SETTINGS_FILE, 'w') as f:
        json.dump(hospital_settings, f, indent=4)

# --- MERKLE TREE IMPLEMENTATION ---
class MerkleTree:
    def __init__(self, data_chunks):
        self.leaves = [self.hash_data(chunk) for chunk in data_chunks]
        self.tree = self.build_tree(self.leaves)
        self.root = self.tree[-1][0] if self.tree else ""

    def hash_data(self, data):
        return hashlib.sha256(data.encode('utf-8')).hexdigest()

    def build_tree(self, leaves):
        if not leaves:
            return []
            
        tree = [leaves]
        current_level = leaves

        while len(current_level) > 1:
            next_level = []
            for i in range(0, len(current_level), 2):
                left = current_level[i]
                right = current_level[i + 1] if (i + 1) < len(current_level) else left
                combined_hash = self.hash_data(left + right)
                next_level.append(combined_hash)
            
            tree.append(next_level)
            current_level = next_level
            
        return tree

    def get_root(self):
        return self.root

    def get_tree_structure(self):
        return self.tree

# --- BLOCKCHAIN LEDGER ---
class HealthLedger:
    def __init__(self):
        self.chain = []
        # load_data() will populate this

    def save_chain(self):
        with open(LEDGER_FILE, 'w') as f:
            json.dump(self.chain, f, indent=4)

    def add_record(self, merkle_root, owner_id, record_meta, tree_structure):
        prev_hash = self.chain[-1]['hash'] if self.chain else "0000"
        timestamp = datetime.datetime.now().isoformat()
        
        # Block content to hash
        block_content = f"{merkle_root}{timestamp}{owner_id}"
        block_hash = hashlib.sha256(block_content.encode('utf-8')).hexdigest()

        block = {
            "index": len(self.chain),
            "timestamp": timestamp,
            "prevHash": prev_hash,
            "merkleRoot": merkle_root,
            "owner": owner_id,
            "meta": record_meta, # { filename, description, doctor_access: [] }
            "hash": block_hash,
            "tree": tree_structure
        }
        
        self.chain.append(block)
        self.save_chain()
        return block

ledger = HealthLedger()
load_data() # Initial load

# --- HELPER: AUTH ---
# Simple token simulation. In prod, use JWT.
sessions = {} # { token: username }

def require_auth(f):
    def wrapper(*args, **kwargs):
        token = request.headers.get('Authorization')
        if not token or token not in sessions:
            return jsonify({"error": "Unauthorized"}), 401
        return f(sessions[token], *args, **kwargs)
    wrapper.__name__ = f.__name__ # Fix flask endpoint conflict
    return wrapper

# --- API ROUTES ---

@app.route('/')
def home():
    return send_from_directory(app.static_folder, 'index.html')

# AUTH
@app.route('/api/register', methods=['POST'])
def register():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    role = data.get('role') # 'patient' or 'doctor'

    name = data.get('name', username)

    if not username or not password:
        return jsonify({"error": "Username and password required"}), 400

    if username in users:
        return jsonify({"error": "User already exists"}), 409
    
    users[username] = {
        "password": password, # In prod, HASH THIS!
        "role": role,
        "name": name,
        "access_allow_list": [] # For patients: list of doctors allowed
    }
    save_users()
    return jsonify({"message": "Registered successfully"})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')

    if username not in users or users[username]['password'] != password:
        return jsonify({"error": "Invalid credentials"}), 401
    
    token = secrets.token_hex(16)
    sessions[token] = username
    return jsonify({
        "token": token,
        "role": users[username]['role'],
        "name": users[username]['name']
    })

# RECORDS & LEDGER

@app.route('/api/upload-record', methods=['POST'])
def upload_record():
    token = request.headers.get('Authorization')
    if not token or token not in sessions:
        return jsonify({"error": "Unauthorized"}), 401
    
    user = sessions[token]
    if users[user]['role'] != 'patient':
        return jsonify({"error": "Only patients can upload records"}), 403

    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400
        
    file = request.files['file']
    description = request.form.get('description', 'Medical Record')
    
    file_bytes = file.read()
    if len(file_bytes) == 0:
        return jsonify({"error": "Empty file"}), 400
    
    # --- SAVE FILE TO DISK ---
    # UPLOAD_FOLDER defined globally
    if not os.path.exists(UPLOAD_FOLDER):
        os.makedirs(UPLOAD_FOLDER)
        
    # Generate unique filename to prevent overwrites
    import time
    file_ext = os.path.splitext(file.filename)[1]
    safe_filename = f"{int(time.time())}_{secrets.token_hex(4)}{file_ext}"
    file_path = os.path.join(UPLOAD_FOLDER, safe_filename)
    
    # Save file
    with open(file_path, 'wb') as f:
        f.write(file_bytes)
        
    file_url = f"http://127.0.0.1:{PORT}/uploads/{safe_filename}"
    
    # Create chunks for Merkle Tree
    chunk_size = 1024
    chunks = []
    import base64
    for i in range(0, len(file_bytes), chunk_size):
        chunk_bytes = file_bytes[i:i+chunk_size]
        chunk_str = base64.b64encode(chunk_bytes).decode('utf-8')
        chunks.append(chunk_str)

    merkle_tree = MerkleTree(chunks)
    root = merkle_tree.get_root()
    tree_structure = merkle_tree.get_tree_structure()
    
    record_meta = {
        "filename": file.filename,
        "saved_filename": safe_filename,
        "fileUrl": file_url,
        "description": description,
        "size": len(file_bytes),
        "access_list": users[user].get('access_allow_list', [])
    }

    block = ledger.add_record(root, user, record_meta, tree_structure)

    return jsonify({
        "message": "Record Anchored to Chain",
        "block": block,
        "fileUrl": file_url
    })

@app.route('/api/records/<int:index>', methods=['DELETE'])
def delete_record(index):
    token = request.headers.get('Authorization')
    if not token or token not in sessions:
        return jsonify({"error": "Unauthorized"}), 401
    
    current_user = sessions[token]
    
    if index < 0 or index >= len(ledger.chain):
        return jsonify({"error": "Record not found"}), 404
        
    block = ledger.chain[index]
    
    # Check ownership
    if block.get('owner') != current_user:
        return jsonify({"error": "You do not own this record"}), 403
        
    # Mark as deleted (Soft Delete)
    if block.get('is_deleted'):
        return jsonify({"message": "Record already deleted"}), 200
        
    block['is_deleted'] = True
    ledger.save_chain()
    
    return jsonify({"message": "Record deleted successfully"})

@app.route('/uploads/<path:filename>')
def serve_upload(filename):
    return send_from_directory(UPLOAD_FOLDER, filename)

@app.route('/api/records', methods=['GET'])
def get_records():
    token = request.headers.get('Authorization')
    if not token or token not in sessions:
        return jsonify({"error": "Unauthorized"}), 401
    
    current_user = sessions[token]
    user_role = users[current_user]['role']
    
    visible_records = []
    
    for block in ledger.chain:
        owner = block.get('owner') # Safely get owner
        if not owner:
            continue

        if block.get('is_deleted'):
            continue

        # Patient sees their own
        if user_role == 'patient' and owner == current_user:
            visible_records.append(block)
        # Doctor sees if they are in the allowed list of the patient
        elif user_role == 'doctor':
            # Check if this doctor is in the patient's access list
            # We look up the PATIENT's current access list from the user store, 
            # OR we can assume the block meta snapshot is authoritative. 
            # Let's use the USER STORE for dynamic access control (revocation works instantly)
            if current_user in users.get(owner, {}).get('access_allow_list', []):
                 visible_records.append(block)

    return jsonify(visible_records)

# DOCTOR & ACCESS CONTROL

@app.route('/api/doctors', methods=['GET'])
def list_doctors():
    # Public list of doctors for patients to choose from
    doctor_list = [{ "username": u, "name": d['name'] } for u, d in users.items() if d['role'] == 'doctor']
    return jsonify(doctor_list)

@app.route('/api/grant-access', methods=['POST'])
def grant_access():
    token = request.headers.get('Authorization')
    if not token or token not in sessions:
        return jsonify({"error": "Unauthorized"}), 401
    
    patient = sessions[token]
    if users[patient]['role'] != 'patient':
        return jsonify({"error": "Only patients can grant access"}), 403
        
    doctor_username = request.json.get('doctor_username')
    
    if doctor_username not in users or users[doctor_username]['role'] != 'doctor':
        return jsonify({"error": "Invalid doctor"}), 400
        
    if doctor_username not in users[patient].get('access_allow_list', []):
        if 'access_allow_list' not in users[patient]:
             users[patient]['access_allow_list'] = []
        users[patient]['access_allow_list'].append(doctor_username)
        save_users()
        
    return jsonify({"message": f"Access granted to {doctor_username}"})

@app.route('/api/revoke-access', methods=['POST'])
def revoke_access():
    token = request.headers.get('Authorization')
    if not token or token not in sessions:
        return jsonify({"error": "Unauthorized"}), 401
    
    patient = sessions[token]
    doctor_username = request.json.get('doctor_username')
    
    if 'access_allow_list' in users[patient] and doctor_username in users[patient]['access_allow_list']:
        users[patient]['access_allow_list'].remove(doctor_username)
        save_users()
        
    return jsonify({"message": f"Access revoked for {doctor_username}"})

@app.route('/api/access-list', methods=['GET'])
def get_access_list():
    token = request.headers.get('Authorization')
    if not token or token not in sessions:
        return jsonify({"error": "Unauthorized"}), 401
    
    patient = sessions[token]
    if users[patient]['role'] != 'patient':
        return jsonify({"error": "Only patients have access lists"}), 403
        
    access_list = users[patient].get('access_allow_list', [])
    return jsonify(access_list)

@app.route('/api/chain', methods=['GET'])
def get_chain():
    # Filter out deleted records for general view
    active_chain = [b for b in ledger.chain if not b.get('is_deleted')]
    return jsonify(active_chain)

# HOSPITAL ADMIN
@app.route('/api/audit-log', methods=['POST'])
def add_audit_log():
    # Helper to log access
    token = request.headers.get('Authorization')
    # Allow logging even if token invalid? No, must be auth user
    if not token or token not in sessions:
        return jsonify({"error": "Unauthorized"}), 401
    
    user = sessions[token]
    data = request.json
    
    log_entry = {
        "timestamp": datetime.datetime.now().isoformat(),
        "accessedBy": user,
        "accessedByRole": users[user]['role'],
        "recordOwner": data.get('recordOwner'),
        "recordIndex": data.get('recordIndex'),
        "recordDescription": data.get('recordDescription'),
        "hospitalName": hospital_settings.get('name', 'N/A')
    }
    
    audit_logs.insert(0, log_entry) # Prepend
    if len(audit_logs) > 1000:
        audit_logs.pop() # Keep size manageable
        
    save_audit_logs()
    
    return jsonify({"message": "Logged", "entry": log_entry})

@app.route('/api/audit-logs', methods=['GET'])
def get_audit_logs():
    token = request.headers.get('Authorization')
    if not token or token not in sessions:
        return jsonify({"error": "Unauthorized"}), 401
    
    user = sessions[token]
    if users[user]['role'] != 'hospital_admin':
        return jsonify({"error": "Admin only"}), 403
        
    return jsonify(audit_logs)

@app.route('/api/hospital-settings', methods=['GET', 'PUT'])
def handle_settings():
    # Anyone can read hospital name? Or just authenticated?
    # Let's say public read, admin write
    if request.method == 'GET':
        return jsonify(hospital_settings)
        
    # PUT
    token = request.headers.get('Authorization')
    if not token or token not in sessions:
        return jsonify({"error": "Unauthorized"}), 401
    
    user = sessions[token]
    if users[user]['role'] != 'hospital_admin':
        return jsonify({"error": "Admin only"}), 403
        
    data = request.json
    if 'name' in data:
        hospital_settings['name'] = data['name']
        save_settings()
        
    return jsonify(hospital_settings)

if __name__ == '__main__':
    print(f"SwasthyaChain Backend running on http://localhost:{PORT}")
    app.run(port=PORT, debug=True)
