/**
 * Consent Manager for Wearable Ledger
 * Simulates a secure backend for consent, access control, and audit logging.
 */

const ConsentManager = {
    // Keys for localStorage
    KEYS: {
        REQUESTS: 'swasthya_requests',
        CONSENTS: 'swasthya_consents',
        NOTIFICATIONS: 'swasthya_notifications',
        LOGS: 'swasthya_logs',
        RECORDS: 'swasthya_local_records' // simulating db records to associate IDs
    },

    // Initialize storage if empty
    init() {
        if (!localStorage.getItem(this.KEYS.REQUESTS)) localStorage.setItem(this.KEYS.REQUESTS, JSON.stringify([]));
        if (!localStorage.getItem(this.KEYS.CONSENTS)) localStorage.setItem(this.KEYS.CONSENTS, JSON.stringify([]));
        if (!localStorage.getItem(this.KEYS.NOTIFICATIONS)) localStorage.setItem(this.KEYS.NOTIFICATIONS, JSON.stringify([]));
        if (!localStorage.getItem(this.KEYS.LOGS)) localStorage.setItem(this.KEYS.LOGS, JSON.stringify([]));
        if (!localStorage.getItem(this.KEYS.RECORDS)) localStorage.setItem(this.KEYS.RECORDS, JSON.stringify([]));
    },

    // --- ACCESS REQUESTS ---

    /**
     * Doctor/Admin requests access to a record
     */
    requestAccess(recordId, recordTitle, doctorName, doctorRole, hospitalName) {
        const requests = JSON.parse(localStorage.getItem(this.KEYS.REQUESTS));
        const existing = requests.find(r => r.recordId === recordId && r.requester === doctorName && r.status === 'pending');

        if (existing) return { success: false, message: 'Request already pending' };

        const request = {
            id: Date.now().toString(),
            recordId,
            recordTitle,
            requester: doctorName,
            requesterRole: doctorRole,
            hospital: hospitalName,
            status: 'pending',
            timestamp: new Date().toISOString()
        };

        requests.push(request);
        localStorage.setItem(this.KEYS.REQUESTS, JSON.stringify(requests));

        // Notify Patient (Broadcasting to all patients for simulation, or filtered if we had patientId)
        // Since we don't have multi-user backend, we store notification.
        // In this simulation, we assume current user IS the owner if they are a patient.

        this.addNotification({
            type: 'request',
            message: `${doctorName} (${doctorRole}) at ${hospitalName} requested access to "${recordTitle}"`,
            requestId: request.id,
            timestamp: new Date().toISOString()
        });

        this.logActivity(doctorName, 'REQUEST_ACCESS', `Requested access to record ${recordId}`);
        return { success: true };
    },

    /**
     * Get pending requests for the patient
     */
    getPendingRequests() {
        const requests = JSON.parse(localStorage.getItem(this.KEYS.REQUESTS)) || [];
        if (!Array.isArray(requests)) return [];
        return requests.filter(r => r.status === 'pending').sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    /**
     * Get outgoing requests (for doctor view)
     */
    getMyRequests(doctorName) {
        const requests = JSON.parse(localStorage.getItem(this.KEYS.REQUESTS)) || [];
        if (!Array.isArray(requests)) return [];
        return requests.filter(r => r.requester === doctorName).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    },

    // --- APPROVAL / DENIAL ---

    approveAccess(requestId) {
        const requests = JSON.parse(localStorage.getItem(this.KEYS.REQUESTS));
        const reqIndex = requests.findIndex(r => r.id === requestId);

        if (reqIndex === -1) return { success: false, message: 'Request not found' };

        const req = requests[reqIndex];
        req.status = 'approved';
        requests[reqIndex] = req;
        localStorage.setItem(this.KEYS.REQUESTS, JSON.stringify(requests));

        // Grant Access
        const consents = JSON.parse(localStorage.getItem(this.KEYS.CONSENTS));
        consents.push({
            recordId: req.recordId,
            grantee: req.requester, // doctor name as ID for this sim
            grantedAt: new Date().toISOString()
        });
        localStorage.setItem(this.KEYS.CONSENTS, JSON.stringify(consents));

        this.logActivity('Patient', 'APPROVE_ACCESS', `Approved access for ${req.requester} to ${req.recordTitle}`);
        return { success: true };
    },

    denyAccess(requestId) {
        const requests = JSON.parse(localStorage.getItem(this.KEYS.REQUESTS));
        const reqIndex = requests.findIndex(r => r.id === requestId);

        if (reqIndex === -1) return { success: false, message: 'Request not found' };

        const req = requests[reqIndex];
        req.status = 'denied';
        requests[reqIndex] = req;
        localStorage.setItem(this.KEYS.REQUESTS, JSON.stringify(requests));

        this.logActivity('Patient', 'DENY_ACCESS', `Denied access for ${req.requester} to ${req.recordTitle}`);
        return { success: true };
    },

    revokeAccess(recordId, doctorName) {
        let consents = JSON.parse(localStorage.getItem(this.KEYS.CONSENTS));
        consents = consents.filter(c => !(c.recordId === recordId && c.grantee === doctorName));
        localStorage.setItem(this.KEYS.CONSENTS, JSON.stringify(consents));

        // Also update request status if exists
        const requests = JSON.parse(localStorage.getItem(this.KEYS.REQUESTS));
        const req = requests.find(r => r.recordId === recordId && r.requester === doctorName);
        if (req) {
            req.status = 'revoked';
            localStorage.setItem(this.KEYS.REQUESTS, JSON.stringify(requests));
        }

        this.logActivity('Patient', 'REVOKE_ACCESS', `Revoked access for ${doctorName} to record ${recordId}`);

        // Notify the revoked user
        this.addNotification({
            type: 'access_revoked',
            message: `Access revoked for record ${recordId}`,
            targetUser: doctorName,
            timestamp: new Date().toISOString()
        });

        return { success: true };
    },

    // --- CHECK ACCESS ---

    hasAccess(doctorName, recordId) {
        // If patient, always access (simplified)
        // In real app, check user ID. Here we assume caller handles "is patient" check.
        const consents = JSON.parse(localStorage.getItem(this.KEYS.CONSENTS));
        return consents.some(c => c.recordId === recordId && c.grantee === doctorName);
    },

    getRecordStatusForDoctor(doctorName, recordId) {
        if (this.hasAccess(doctorName, recordId)) return 'approved';

        const requests = JSON.parse(localStorage.getItem(this.KEYS.REQUESTS));
        const req = requests.find(r => r.recordId === recordId && r.requester === doctorName);

        if (req) return req.status; // pending, denied, revoked
        return 'none';
    },

    // --- NOTIFICATIONS ---

    addNotification(notification) {
        const notifications = JSON.parse(localStorage.getItem(this.KEYS.NOTIFICATIONS));
        notifications.unshift({
            id: Date.now().toString(),
            read: false,
            ...notification
        });
        localStorage.setItem(this.KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    },

    getNotifications() {
        return JSON.parse(localStorage.getItem(this.KEYS.NOTIFICATIONS));
    },

    markRead(notifId) {
        const notifications = JSON.parse(localStorage.getItem(this.KEYS.NOTIFICATIONS));
        const n = notifications.find(n => n.id === notifId);
        if (n) {
            n.read = true;
            localStorage.setItem(this.KEYS.NOTIFICATIONS, JSON.stringify(notifications));
        }
    },

    markAllRead() {
        const notifications = JSON.parse(localStorage.getItem(this.KEYS.NOTIFICATIONS));
        notifications.forEach(n => n.read = true);
        localStorage.setItem(this.KEYS.NOTIFICATIONS, JSON.stringify(notifications));
    },

    getUnreadCount() {
        const notifications = JSON.parse(localStorage.getItem(this.KEYS.NOTIFICATIONS)) || [];
        if (!Array.isArray(notifications)) return 0;
        return notifications.filter(n => !n.read).length;
    },

    // --- ACTIVITY LOGS ---

    logActivity(actor, action, details) {
        const logs = JSON.parse(localStorage.getItem(this.KEYS.LOGS));
        logs.unshift({
            timestamp: new Date().toISOString(),
            actor,
            action,
            details
        });
        localStorage.setItem(this.KEYS.LOGS, JSON.stringify(logs));
    },

    getLogs() {
        return JSON.parse(localStorage.getItem(this.KEYS.LOGS));
    },

    // --- RECORD MANAGEMENT (Simulation) ---
    registerRecord(record) {
        let localRecords = JSON.parse(localStorage.getItem(this.KEYS.RECORDS) || '[]');
        localRecords.push(record);
        localStorage.setItem(this.KEYS.RECORDS, JSON.stringify(localRecords));
    },

    getAllRecords() {
        return JSON.parse(localStorage.getItem(this.KEYS.RECORDS) || '[]');
    },

    deleteRecord(recordId) {
        let localRecords = JSON.parse(localStorage.getItem(this.KEYS.RECORDS) || '[]');
        const deletedIds = JSON.parse(localStorage.getItem('swasthya_deleted_ids') || '[]');

        // Add to deleted set
        deletedIds.push(recordId);
        localStorage.setItem('swasthya_deleted_ids', JSON.stringify(deletedIds));

        // Also remove from local "public directory"
        localRecords = localRecords.filter(r => r.id != recordId && r.index != recordId);
        localStorage.setItem(this.KEYS.RECORDS, JSON.stringify(localRecords));

        // Remove all consents
        let consents = JSON.parse(localStorage.getItem(this.KEYS.CONSENTS));
        const initialLen = consents.length;
        consents = consents.filter(c => c.recordId != recordId);
        if (consents.length < initialLen) {
            localStorage.setItem(this.KEYS.CONSENTS, JSON.stringify(consents));
        }

        this.logActivity('Patient', 'DELETE_RECORD', `Deleted record ${recordId}`);
    },

    isDeleted(recordId) {
        const deletedIds = JSON.parse(localStorage.getItem('swasthya_deleted_ids') || '[]');
        return deletedIds.includes(recordId) || deletedIds.includes(String(recordId));
    }
};

// Initialize on load
ConsentManager.init();
