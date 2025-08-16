import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';
console.log(`API_BASE_URL: ${API_BASE_URL}`);

export interface User {
  id: string;
  email: string;
}

export interface Tracker {
  id: string;
  instagramUsername: string;
  currentFollowingCount: number;
  notificationEmail: string;
  createdAt: string;
  lastChecked: string;
  countOnly?: boolean;
}

export interface AuthResponse {
  message: string;
  token: string;
  user: User;
}

export interface TrackersResponse {
  trackers: Tracker[];
}

class ApiService {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('token');
    this.setupInterceptors();
  }

  private setupInterceptors() {
    axios.interceptors.request.use((config) => {
      if (this.token) {
        config.headers.Authorization = `Bearer ${this.token}`;
      }
      return config;
    });

    axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          this.logout();
        }
        return Promise.reject(error);
      }
    );
  }

  setToken(token: string) {
    this.token = token;
    localStorage.setItem('token', token);
  }

  logout() {
    this.token = null;
    localStorage.removeItem('token');
    window.location.href = '/login';
  }

  async register(email: string, password: string): Promise<AuthResponse> {
    const response = await axios.post(`${API_BASE_URL}/auth/register`, {
      email,
      password
    });
    return response.data;
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await axios.post(`${API_BASE_URL}/auth/login`, {
      email,
      password
    });
    return response.data;
  }

  async getTrackers(): Promise<TrackersResponse> {
    const response = await axios.get(`${API_BASE_URL}/trackers`);
    return response.data;
  }

  async addTracker(instagramUsername: string, notificationEmail: string): Promise<any> {
    const response = await axios.post(`${API_BASE_URL}/trackers`, {
      instagramUsername,
      notificationEmail
    });
    return response.data;
  }

  async removeTracker(trackerId: string): Promise<any> {
    const response = await axios.delete(`${API_BASE_URL}/trackers/${trackerId}`);
    return response.data;
  }

  async triggerManualCheck(): Promise<any> {
    const response = await axios.post(`${API_BASE_URL}/test/trigger-check`);
    return response.data;
  }

  /**
   * Detect baby images in the latest posts of a public Instagram profile
   */
  async detectBabies(username: string): Promise<string[]> {
    const response = await axios.get(`${API_BASE_URL}/baby/${username}`);
    // backend returns { urls: BabyDetection[] }
    return response.data.urls;
  }

  async manualDetect(urls: string[]): Promise<any[]> {
  // removed manual detect endpoint
  throw new Error('manualDetect removed');
  }

  isAuthenticated(): boolean {
    return !!this.token;
  }
}

export const apiService = new ApiService();