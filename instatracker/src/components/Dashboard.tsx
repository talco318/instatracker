import React, { useState, useEffect } from 'react';
import { Tracker, apiService } from '../services/api';
import './Dashboard.css';

interface DashboardProps {
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [showDetectPage, setShowDetectPage] = useState(false);
  const [babyUsername, setBabyUsername] = useState('');
  // babyResults will be an array of objects returned from the backend: { url, has_baby, babies }
  const [babyResults, setBabyResults] = useState<any[] | null>(null);
  const [detecting, setDetecting] = useState(false);
  const [instagramUsername, setInstagramUsername] = useState('');
  const [notificationEmail, setNotificationEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadTrackers();
  }, []);

  const loadTrackers = async () => {
    setLoading(true);
    try {
      const response = await apiService.getTrackers();
      setTrackers(response.trackers);
    } catch (err: any) {
      setError('Failed to load trackers');
    } finally {
      setLoading(false);
    }
  };

  const handleAddTracker = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      await apiService.addTracker(instagramUsername, notificationEmail);
      setInstagramUsername('');
      setNotificationEmail('');
      setShowAddForm(false);
      await loadTrackers();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add tracker');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveTracker = async (trackerId: string) => {
    if (!window.confirm('Are you sure you want to remove this tracker?')) {
      return;
    }

    try {
      await apiService.removeTracker(trackerId);
      await loadTrackers();
    } catch (err: any) {
      setError('Failed to remove tracker');
    }
  };

  const triggerManualCheck = async () => {
    try {
      await apiService.triggerManualCheck();
      alert('Manual check triggered successfully');
    } catch (err: any) {
      alert('Failed to trigger manual check');
    }
  };
  const handleDetectBabies = async (e: React.FormEvent) => {
    e.preventDefault();
    setDetecting(true);
    setBabyResults(null);
    try {
      const results = await apiService.detectBabies(babyUsername.trim().replace('@', ''));
      // normalize: ensure each item is an object with a url
      const normalized = (results || []).map((r: any) => {
        if (typeof r === 'string') return { url: r, has_baby: false, babies: [] };
        return r;
      });
      setBabyResults(normalized);
    } catch {
      setBabyResults([]);
    } finally {
      setDetecting(false);
    }
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>InstaTracker Dashboard</h1>
        <div className="header-actions">
          <button onClick={triggerManualCheck} className="test-btn">
            Trigger Check (Test)
          </button>
          <button onClick={() => setShowDetectPage(!showDetectPage)} className="test-btn">
            No Baby No Cry
          </button>
          <button onClick={onLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </header>

      {showDetectPage ? (
        <div className="detect-section">
          <h2>No Baby No Cry</h2>
          <form onSubmit={handleDetectBabies} className="detect-form">
            <input
              type="text"
              placeholder="Instagram username"
              value={babyUsername}
              onChange={e => setBabyUsername(e.target.value)}
              required
            />
            <button type="submit" disabled={detecting} className="submit-btn">
              {detecting ? 'Detecting...' : 'Detect'}
            </button>
          </form>
          {babyResults && (
            babyResults.length > 0 ? (
              <div className="baby-list">
                {babyResults.map((item, idx) => (
                  <div className="baby-item" key={`${item.url}-${idx}`}>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="baby-link">
                      {/* defensive: ensure we don't render invalid URLs directly */}
                      {(() => {
                        let src = item.url;
                        try {
                          // throws if invalid
                          new URL(src);
                        } catch (_) {
                          src = '';
                        }
                        // inline SVG placeholder (encoded) used as onError fallback
                        const placeholder = 'data:image/svg+xml;utf8,%3Csvg xmlns="http://www.w3.org/2000/svg" width="300" height="200" viewBox="0 0 300 200"%3E%3Crect width="100%25" height="100%25" fill="%23f3f4f6"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%23999" font-family="Arial,Helvetica,sans-serif" font-size="14"%3EImage not available%3C/text%3E%3C/svg%3E';
                        return (
                          <img
                            src={src || placeholder}
                            alt={`post-${idx}`}
                            className="baby-thumb"
                            loading="lazy"
                            onError={(e) => {
                              const img = e.currentTarget as HTMLImageElement;
                              img.onerror = null;
                              img.src = placeholder;
                              img.classList.add('broken');
                            }}
                          />
                        );
                      })()}
                    </a>
                    <div className="baby-meta">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="baby-link-url">{new URL(item.url).hostname}</a>
                      <div className="baby-result">
                        {item.has_baby ? (
                          <span className="baby-flag">Detected</span>
                        ) : (
                          <span className="no-baby">No baby</span>
                        )}
                        <span className="baby-confidence">{item.babies?.[0]?.confidence ? ` · ${Math.round(item.babies[0].confidence * 100)}%` : ''}</span>
                      </div>
                      {item.babies?.[0]?.notes && (
                        <div className="baby-notes">{item.babies[0].notes}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p>No baby images detected.</p>
            )
          )}
        </div>
      ) : (
      <div className="dashboard-content">
        {error && <div className="error">{error}</div>}

        <div className="trackers-section">
          <div className="section-header">
            <h2>Your Trackers ({trackers.length}/3)</h2>
            {trackers.length < 3 && (
              <button 
                onClick={() => setShowAddForm(!showAddForm)}
                className="add-btn"
              >
                {showAddForm ? 'Cancel' : 'Add Tracker'}
              </button>
            )}
          </div>

          {showAddForm && (
            <div className="add-form">
              <h3>Add New Tracker</h3>
              <form onSubmit={handleAddTracker}>
                <div className="form-group">
                  <label htmlFor="username">Instagram Username</label>
                  <input
                    type="text"
                    id="username"
                    value={instagramUsername}
                    onChange={(e) => setInstagramUsername(e.target.value)}
                    placeholder="@username or username"
                    required
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="email">Notification Email</label>
                  <input
                    type="email"
                    id="email"
                    value={notificationEmail}
                    onChange={(e) => setNotificationEmail(e.target.value)}
                    placeholder="notifications@example.com"
                    required
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" disabled={submitting} className="submit-btn">
                    {submitting ? 'Adding...' : 'Add Tracker'}
                  </button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <div className="loading">Loading trackers...</div>
          ) : trackers.length === 0 ? (
            <div className="empty-state">
              <p>No trackers yet. Add one to get started!</p>
            </div>
          ) : (
            <div className="trackers-list">
              {trackers.map((tracker) => (
                <div key={tracker.id} className="tracker-card">
                  <div className="tracker-info">
                    <div className="tracker-header">
                      <h3>@{tracker.instagramUsername}</h3>
                      {tracker.countOnly && (
                        <span className="count-only-badge">Count Only</span>
                      )}
                    </div>
                    <p className="following-count">
                      Following: {tracker.currentFollowingCount}
                      {tracker.countOnly && ' (count tracking only)'}
                    </p>
                    <p className="notification-email">
                      Notifications: {tracker.notificationEmail}
                    </p>
                    <p className="tracker-meta">
                      Added: {new Date(tracker.createdAt).toLocaleDateString()}
                      {tracker.lastChecked && (
                        <span>
                          {' • Last checked: '}
                          {new Date(tracker.lastChecked).toLocaleString()}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="tracker-actions">
                    <button 
                      onClick={() => handleRemoveTracker(tracker.id)}
                      className="remove-btn"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="info-section">
          <h3>How it works</h3>
          <ul>
            <li>Add up to 3 Instagram accounts to track</li>
            <li>We monitor public accounts only (max 100 following)</li>
            <li>Get email notifications when they follow someone new</li>
            <li>Checks run automatically every hour</li>
            <li><strong>Count Only:</strong> Some trackers may only track following count changes (not exact usernames) due to API limitations</li>
          </ul>
        </div>
      </div>
      )}
    </div>
  );
};

export default Dashboard;