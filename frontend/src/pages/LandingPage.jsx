import { useNavigate } from 'react-router-dom';
import { Target, Mic, Activity, LineChart, FileText, Zap, ChevronRight } from 'lucide-react';
import './LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();

  const features = [
    { icon: <Target className="feature-icon" />, title: 'Smart Questions', desc: 'AI-generated questions tailored to your domain' },
    { icon: <Mic className="feature-icon" />, title: 'Voice Interaction', desc: 'Natural speech-based Q&A' },
    { icon: <Activity className="feature-icon" />, title: 'Behavior Analysis', desc: 'Real-time posture and expression tracking' },
    { icon: <LineChart className="feature-icon" />, title: 'Performance Scoring', desc: 'Detailed evaluation metrics' },
    { icon: <FileText className="feature-icon" />, title: 'PDF Reports', desc: 'Downloadable performance summaries' },
    { icon: <Zap className="feature-icon" />, title: 'Instant Feedback', desc: 'Real-time AI-powered insights' }
  ];

  return (
    <div className="landing-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="hero-content">
          <h1 className="hero-title">
            Master Your Next Interview <br />
            <span className="gradient-text">With AI</span>
          </h1>
          <p className="hero-subtitle">
            Practice with our AI-powered simulator featuring real-time feedback, voice interaction, and comprehensive performance analysis.
          </p>
          <div className="hero-actions">
            <button className="btn-primary" onClick={() => navigate('/setup')}>
              Start Practicing <ChevronRight size={20} />
            </button>
          </div>
        </div>
        
        <div className="hero-stats glass-card">
          <div className="stat-item">
            <span className="stat-value gradient-text">10+</span>
            <span className="stat-label">Domains</span>
          </div>
          <div className="stat-item">
            <span className="stat-value gradient-text">Real-time</span>
            <span className="stat-label">Feedback</span>
          </div>
          <div className="stat-item">
            <span className="stat-value gradient-text">AI</span>
            <span className="stat-label">Powered</span>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="features">
        <h2 className="section-title">Why Reality Rehearsal?</h2>
        <div className="features-grid">
          {features.map((feature, index) => (
            <div key={index} className="feature-card glass-card">
              <div className="feature-icon-wrapper">
                {feature.icon}
              </div>
              <h3>{feature.title}</h3>
              <p>{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How It Works Section */}
      <section className="how-it-works">
        <h2 className="section-title">How It Works</h2>
        <div className="steps-container">
          <div className="step glass-card">
            <div className="step-number">1</div>
            <h3>Choose Domain & Difficulty</h3>
            <p>Select your field and desired difficulty level to generate targeted questions.</p>
          </div>
          <div className="step-connector"></div>
          <div className="step glass-card">
            <div className="step-number">2</div>
            <h3>Practice with AI Interviewer</h3>
            <p>Answer questions naturally via voice while our AI analyzes your performance.</p>
          </div>
          <div className="step-connector"></div>
          <div className="step glass-card">
            <div className="step-number">3</div>
            <h3>Get Your Performance Report</h3>
            <p>Review detailed scores, strengths, and areas for improvement in a downloadable report.</p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta glass-card">
        <h2>Ready to Ace Your Interview?</h2>
        <p>Start your AI-powered practice session today and boost your confidence.</p>
        <button className="btn-primary" onClick={() => navigate('/setup')}>
          Start Now <ChevronRight size={20} />
        </button>
      </section>

      {/* Footer */}
      <footer className="footer">
        <p>Built with ❤️ and AI</p>
      </footer>
    </div>
  );
};

export default LandingPage;
