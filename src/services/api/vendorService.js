import vendorsData from "@/services/mockData/vendors.json";

class VendorService {
  constructor() {
    this.vendors = [...vendorsData];
    this.currentSession = null;
  }

  async login(credentials) {
    await this.delay(500);
    
    const { email, password } = credentials;
    
    if (!email || !password) {
      throw new Error('Email and password are required');
    }
    
    const vendor = this.vendors.find(v => 
      v.email.toLowerCase() === email.toLowerCase() && 
      v.password === password &&
      v.isActive
    );
    
    if (!vendor) {
      throw new Error('Invalid email or password');
    }
    
    // Create session
    this.currentSession = {
      vendorId: vendor.Id,
      email: vendor.email,
      name: vendor.name,
      role: 'vendor',
      loginTime: new Date().toISOString(),
      permissions: vendor.permissions || ['view_products', 'edit_prices']
    };
    
    // Store session in localStorage
    localStorage.setItem('vendorSession', JSON.stringify(this.currentSession));
    
return {
      vendor: {
        Id: vendor.Id,
        name: vendor.name,
        email: vendor.email,
        company: vendor.company,
        phone: vendor.phone,
        permissions: vendor.permissions || ['view_products', 'edit_prices'],
        bankDetails: vendor.bankDetails || {
          accountTitle: '',
          accountNumber: '',
          bankName: '',
          branchCode: ''
        },
        mobileWallet: vendor.mobileWallet || {
          jazzCash: '',
          easyPaisa: '',
          uPaisa: ''
        }
      },
      session: this.currentSession
    };
  }
  async logout() {
    await this.delay(200);
    
    this.currentSession = null;
    localStorage.removeItem('vendorSession');
    
    return { success: true };
  }

  getCurrentSession() {
    if (this.currentSession) {
      return this.currentSession;
    }
    
    try {
      const storedSession = localStorage.getItem('vendorSession');
      if (storedSession) {
        this.currentSession = JSON.parse(storedSession);
        return this.currentSession;
      }
    } catch (error) {
      console.error('Error retrieving vendor session:', error);
    }
    
    return null;
  }

  async validateSession() {
    await this.delay(100);
    
    const session = this.getCurrentSession();
    
    if (!session) {
      return { valid: false, error: 'No active session' };
    }
    
    // Check if vendor still exists and is active
    const vendor = this.vendors.find(v => v.Id === session.vendorId && v.isActive);
    
    if (!vendor) {
      this.logout();
      return { valid: false, error: 'Vendor account not found or inactive' };
    }
    
    // Check session age (24 hours)
    const loginTime = new Date(session.loginTime);
    const now = new Date();
    const hoursDiff = (now - loginTime) / (1000 * 60 * 60);
    
    if (hoursDiff > 24) {
      this.logout();
      return { valid: false, error: 'Session expired' };
    }
    
    return { valid: true, session };
  }

  async getVendorProfile(vendorId) {
    await this.delay(200);
    
    const vendor = this.vendors.find(v => v.Id === parseInt(vendorId));
    
    if (!vendor) {
      throw new Error('Vendor not found');
    }
    
return {
      Id: vendor.Id,
      name: vendor.name,
      email: vendor.email,
      company: vendor.company,
      phone: vendor.phone,
      address: vendor.address,
      joinDate: vendor.joinDate,
      permissions: vendor.permissions || ['view_products', 'edit_prices'],
      isActive: vendor.isActive,
      bankDetails: vendor.bankDetails || {
        accountTitle: '',
        accountNumber: '',
        bankName: '',
        branchCode: ''
      },
      mobileWallet: vendor.mobileWallet || {
        jazzCash: '',
        easyPaisa: '',
        uPaisa: ''
      }
    };
  }

  async updateVendorProfile(vendorId, profileData) {
    await this.delay(300);
    
    const vendorIndex = this.vendors.findIndex(v => v.Id === parseInt(vendorId));
    
    if (vendorIndex === -1) {
      throw new Error('Vendor not found');
    }
    
    // Validate required fields
    if (profileData.email && !this.isValidEmail(profileData.email)) {
      throw new Error('Invalid email format');
    }
    
    if (profileData.phone && !this.isValidPhone(profileData.phone)) {
      throw new Error('Invalid phone number format');
    }
    
    // Check for duplicate email
    if (profileData.email) {
      const existingVendor = this.vendors.find(v => 
        v.email.toLowerCase() === profileData.email.toLowerCase() && 
        v.Id !== parseInt(vendorId)
      );
      
      if (existingVendor) {
        throw new Error('Email already exists');
      }
    }
    
    // Update vendor profile
    this.vendors[vendorIndex] = {
      ...this.vendors[vendorIndex],
      ...profileData,
      Id: this.vendors[vendorIndex].Id, // Preserve ID
      lastUpdated: new Date().toISOString()
    };
// Import WebSocket service for real-time sync
    try {
      const { webSocketService } = await import('@/services/api/websocketService');
      webSocketService.send({
        type: 'vendor_profile_updated',
        data: {
          vendorId: vendorId,
          updatedFields: Object.keys(profileData),
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      console.warn('WebSocket notification failed:', error);
    }
    
    return {
      Id: this.vendors[vendorIndex].Id,
      name: this.vendors[vendorIndex].name,
      email: this.vendors[vendorIndex].email,
      company: this.vendors[vendorIndex].company,
      phone: this.vendors[vendorIndex].phone,
      address: this.vendors[vendorIndex].address
    };
  }

  async changePassword(vendorId, passwordData) {
    await this.delay(400);
    
    const { currentPassword, newPassword, confirmPassword } = passwordData;
    
    if (!currentPassword || !newPassword || !confirmPassword) {
      throw new Error('All password fields are required');
    }
    
    if (newPassword !== confirmPassword) {
      throw new Error('New passwords do not match');
    }
    
    if (newPassword.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }
    
    const vendorIndex = this.vendors.findIndex(v => v.Id === parseInt(vendorId));
    
    if (vendorIndex === -1) {
      throw new Error('Vendor not found');
    }
    
    if (this.vendors[vendorIndex].password !== currentPassword) {
      throw new Error('Current password is incorrect');
    }
    
    this.vendors[vendorIndex].password = newPassword;
    this.vendors[vendorIndex].lastPasswordChange = new Date().toISOString();
    
    return { success: true };
  }

async getAllVendors() {
    await this.delay(200);
    
    return this.vendors.map(vendor => ({
      Id: vendor.Id,
      name: vendor.name,
      email: vendor.email,
      company: vendor.company,
      phone: vendor.phone,
      bankName: vendor.bankName,
      accountName: vendor.accountName,
      accountNumber: vendor.accountNumber,
      verificationStatus: vendor.verificationStatus || 'pending',
      paymentVerificationStatus: vendor.paymentVerificationStatus || 'pending',
      joinDate: vendor.joinDate,
      isActive: vendor.isActive,
      permissions: vendor.permissions || ['view_products', 'edit_prices']
    }));
  }

  async getAll() {
    await this.delay(200);
    return [...this.vendors];
  }

  async getById(id) {
    await this.delay(200);
    
    const vendor = this.vendors.find(v => v.Id === parseInt(id));
    if (!vendor) {
      throw new Error('Vendor not found');
    }
    
    return { ...vendor };
  }

async create(vendorData) {
    await this.delay(400);
    
    // Validate required fields
    if (!vendorData.name || !vendorData.email || !vendorData.password) {
      throw new Error('Name, email, and password are required');
    }
    
    if (!this.isValidEmail(vendorData.email)) {
      throw new Error('Invalid email format');
    }
    
    // Check for duplicate email
    const existingVendor = this.vendors.find(v => 
      v.email.toLowerCase() === vendorData.email.toLowerCase()
    );
    
    if (existingVendor) {
      throw new Error('Email already exists');
    }
    
    const newVendor = {
      Id: this.getNextId(),
      name: vendorData.name,
      email: vendorData.email,
      password: vendorData.password,
      company: vendorData.company || '',
      phone: vendorData.phone || '',
      address: vendorData.address || '',
      bankName: vendorData.bankName || '',
      accountName: vendorData.accountName || '',
      accountNumber: vendorData.accountNumber || '',
      joinDate: new Date().toISOString(),
      isActive: vendorData.isActive !== undefined ? vendorData.isActive : true,
      permissions: vendorData.permissions || ['view_products', 'edit_prices'],
      createdAt: new Date().toISOString()
    };
    
    this.vendors.push(newVendor);
    return { ...newVendor };
  }

async update(id, vendorData) {
    await this.delay(300);
    
    const vendorIndex = this.vendors.findIndex(v => v.Id === parseInt(id));
    
    if (vendorIndex === -1) {
      throw new Error('Vendor not found');
    }
    
    // Validate email if provided
    if (vendorData.email && !this.isValidEmail(vendorData.email)) {
      throw new Error('Invalid email format');
    }
    
    // Check for duplicate email
    if (vendorData.email) {
      const existingVendor = this.vendors.find(v => 
        v.email.toLowerCase() === vendorData.email.toLowerCase() && 
        v.Id !== parseInt(id)
      );
      
      if (existingVendor) {
        throw new Error('Email already exists');
      }
    }
    
    this.vendors[vendorIndex] = {
      ...this.vendors[vendorIndex],
      ...vendorData,
      Id: this.vendors[vendorIndex].Id, // Preserve ID
      lastUpdated: new Date().toISOString()
    };
    
return { ...this.vendors[vendorIndex] };
  }

  async delete(id) {
    await this.delay(300);
    
    const vendorIndex = this.vendors.findIndex(v => v.Id === parseInt(id));
    
    if (vendorIndex === -1) {
      throw new Error('Vendor not found');
    }
    
    this.vendors.splice(vendorIndex, 1);
    return { success: true };
  }

async createVendor(vendorData) {
    await this.delay(400);
    
    // Validate required fields
    if (!vendorData.name || !vendorData.email || !vendorData.password) {
      throw new Error('Name, email, and password are required');
    }
    
    if (!this.isValidEmail(vendorData.email)) {
      throw new Error('Invalid email format');
    }
    
    // Check for duplicate email
    const existingVendor = this.vendors.find(v => 
      v.email.toLowerCase() === vendorData.email.toLowerCase()
    );
    
    if (existingVendor) {
      throw new Error('Email already exists');
    }
    
    const newVendor = {
      Id: this.getNextId(),
      name: vendorData.name,
      email: vendorData.email,
      password: vendorData.password,
      company: vendorData.company || '',
      phone: vendorData.phone || '',
      address: vendorData.address || '',
      bankName: vendorData.bankName || '',
      accountName: vendorData.accountName || '',
      accountNumber: vendorData.accountNumber || '',
      joinDate: new Date().toISOString(),
      isActive: vendorData.isActive !== undefined ? vendorData.isActive : true,
      permissions: vendorData.permissions || ['view_products', 'edit_prices'],
      createdAt: new Date().toISOString()
    };
    
    this.vendors.push(newVendor);
    
    return {
      Id: newVendor.Id,
      name: newVendor.name,
      email: newVendor.email,
      company: newVendor.company,
      phone: newVendor.phone,
      bankName: newVendor.bankName,
      accountName: newVendor.accountName,
      accountNumber: newVendor.accountNumber,
      joinDate: newVendor.joinDate,
      isActive: newVendor.isActive,
      permissions: newVendor.permissions
    };
  }

async updateVendor(vendorId, vendorData) {
    await this.delay(300);
    
    const vendorIndex = this.vendors.findIndex(v => v.Id === parseInt(vendorId));
    
    if (vendorIndex === -1) {
      throw new Error('Vendor not found');
    }
    
    // Validate email if provided
    if (vendorData.email && !this.isValidEmail(vendorData.email)) {
      throw new Error('Invalid email format');
    }
    
    // Check for duplicate email
    if (vendorData.email) {
      const existingVendor = this.vendors.find(v => 
        v.email.toLowerCase() === vendorData.email.toLowerCase() && 
        v.Id !== parseInt(vendorId)
      );
      
      if (existingVendor) {
        throw new Error('Email already exists');
      }
    }
    
    this.vendors[vendorIndex] = {
      ...this.vendors[vendorIndex],
      ...vendorData,
      Id: this.vendors[vendorIndex].Id, // Preserve ID
      lastUpdated: new Date().toISOString()
    };
    
    return {
      Id: this.vendors[vendorIndex].Id,
      name: this.vendors[vendorIndex].name,
      email: this.vendors[vendorIndex].email,
      company: this.vendors[vendorIndex].company,
      phone: this.vendors[vendorIndex].phone,
      bankName: this.vendors[vendorIndex].bankName,
      accountName: this.vendors[vendorIndex].accountName,
      accountNumber: this.vendors[vendorIndex].accountNumber,
      isActive: this.vendors[vendorIndex].isActive,
      permissions: this.vendors[vendorIndex].permissions
    };
  }

  async deleteVendor(vendorId) {
    await this.delay(300);
    
    const vendorIndex = this.vendors.findIndex(v => v.Id === parseInt(vendorId));
    
    if (vendorIndex === -1) {
      throw new Error('Vendor not found');
    }
    
    this.vendors.splice(vendorIndex, 1);
    
    return { success: true };
  }

  getNextId() {
    const maxId = this.vendors.reduce((max, vendor) => 
      vendor.Id > max ? vendor.Id : max, 0);
    return maxId + 1;
  }

  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}
  
  isValidPhone(phone) {
    const phoneRegex = /^[+]?[\d\s\-()]{10,}$/;
    return phoneRegex.test(phone);
  }

  async delay(ms = 200) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Admin control functions
async toggleVendorStatus(vendorId, status) {
    await this.delay(300);
    
    const vendorIndex = this.vendors.findIndex(v => v.Id === parseInt(vendorId));
    
    if (vendorIndex === -1) {
      throw new Error('Vendor not found');
    }
    
    const isActive = status === 'active';
    this.vendors[vendorIndex].isActive = isActive;
    this.vendors[vendorIndex].statusLastUpdated = new Date().toISOString();
    this.vendors[vendorIndex].lastUpdatedBy = 'admin';
    
    // Log the action
    await this.logAdminAction({
      type: 'vendor_status_change',
      vendorId: vendorId,
      oldStatus: this.vendors[vendorIndex].isActive ? 'inactive' : 'active',
      newStatus: isActive ? 'active' : 'inactive',
      reason: 'Admin status toggle'
    });
    
    return {
      Id: this.vendors[vendorIndex].Id,
      name: this.vendors[vendorIndex].name,
      isActive: isActive,
      statusLastUpdated: this.vendors[vendorIndex].statusLastUpdated
    };
  }

  async updatePaymentVerificationStatus(vendorId, status, notes = '') {
    await this.delay(300);
    
    const vendorIndex = this.vendors.findIndex(v => v.Id === parseInt(vendorId));
    
    if (vendorIndex === -1) {
      throw new Error('Vendor not found');
    }
    
    const oldStatus = this.vendors[vendorIndex].paymentVerificationStatus;
    this.vendors[vendorIndex].paymentVerificationStatus = status;
    this.vendors[vendorIndex].paymentVerificationDate = new Date().toISOString();
    this.vendors[vendorIndex].paymentVerificationNotes = notes;
    this.vendors[vendorIndex].lastUpdatedBy = 'admin';
    
    // Log the payment verification action
    await this.logAdminAction({
      type: 'payment_verification',
      vendorId: vendorId,
      oldStatus: oldStatus,
      newStatus: status,
      notes: notes,
      securityLevel: 'high'
    });
    
    return {
      Id: this.vendors[vendorIndex].Id,
      name: this.vendors[vendorIndex].name,
      paymentVerificationStatus: status,
      paymentVerificationDate: this.vendors[vendorIndex].paymentVerificationDate
    };
  }

  async logAdminAction(action) {
    await this.delay(100);
    
    const logEntry = {
      ...action,
      timestamp: new Date().toISOString(),
      adminId: 'current_admin', // In real app, get from session
      sessionId: 'admin_session_' + Date.now(),
      ipAddress: '127.0.0.1', // In real app, get actual IP
      userAgent: navigator.userAgent
    };
    
    // In real implementation, this would save to secure audit database
    console.log('Admin Action Logged (Security Audit):', logEntry);
    
    // Store in localStorage for demo purposes
    const existingLogs = JSON.parse(localStorage.getItem('adminSecurityLogs') || '[]');
    existingLogs.push(logEntry);
    // Keep only last 100 logs for demo
    if (existingLogs.length > 100) {
      existingLogs.splice(0, existingLogs.length - 100);
    }
    localStorage.setItem('adminSecurityLogs', JSON.stringify(existingLogs));
    
    return logEntry;
  }

  async getSecurityLogs(filter = {}) {
    await this.delay(200);
    
    const logs = JSON.parse(localStorage.getItem('adminSecurityLogs') || '[]');
    
    let filteredLogs = logs;
    
    if (filter.vendorId) {
      filteredLogs = filteredLogs.filter(log => log.vendorId === parseInt(filter.vendorId));
    }
    
    if (filter.type) {
      filteredLogs = filteredLogs.filter(log => log.type === filter.type);
    }
    
    if (filter.securityLevel) {
      filteredLogs = filteredLogs.filter(log => log.securityLevel === filter.securityLevel);
    }
    
    return filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  async notifyVendor(vendorId, message) {
    await this.delay(200);
    
    const vendor = this.vendors.find(v => v.Id === parseInt(vendorId));
    
    if (!vendor) {
      throw new Error('Vendor not found');
    }
    
    // In real implementation, this would send email/SMS/push notification
    const notification = {
      vendorId: vendorId,
      vendorEmail: vendor.email,
      message: message,
      type: 'admin_notification',
      sentAt: new Date().toISOString(),
      status: 'sent'
    };
    
    console.log('Vendor Notification Sent:', notification);
    
    return notification;
  }
}

export const vendorService = new VendorService();