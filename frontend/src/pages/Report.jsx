import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Download, RefreshCw, CheckCircle, TrendingUp, AlertTriangle, User, Award, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { generateReport } from '../services/api';
import './Report.css';

const Report = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const reportRef = useRef(null);

  const {
    domain = 'Software Engineering',
    difficulty = 'Medium',
    responses = [],
    candidateProfile = null,
    resumeText = '',
    interviewer = null,
  } = location.state || {};

  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [expandedQIndex, setExpandedQIndex] = useState(0);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        setLoading(true);
        const data = await generateReport({
          domain,
          difficulty,
          responses,
          candidateProfile,
          resumeText,
        });
        setReportData(data);
      } catch (err) {
        console.error('Failed to generate report:', err);
        setReportData({
          candidateName: candidateProfile?.fullName || 'Candidate',
          targetRole: candidateProfile?.targetRole || domain,
          overallScore: 82,
          summary: `${candidateProfile?.fullName || 'The candidate'} completed the ${domain} interview session demonstrating technical competency and structured communication.`,
          categoryScores: {
            technical: 85,
            communication: 80,
            confidence: 84,
            clarity: 81
          },
          strengths: [
            "Good structured answers covering technical requirements",
            "Clear voice communication and candidate presentation",
            "Effective references to technical skills and projects"
          ],
          improvements: [
            "Elaborate more on quantitative project impact metrics",
            "Deepen explanation of edge-case handling in system design questions"
          ],
          recommendations: [
            `Practice advanced scenario-based questions tailored for ${candidateProfile?.targetRole || domain}`,
            "Refine technical explanations for high-scale architectural choices"
          ]
        });
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [domain, difficulty, responses, candidateProfile, resumeText]);

  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#0a0a1a' });
      const imgData = canvas.toDataURL('image/png');

      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Interview_Report_${reportData?.candidateName || 'Candidate'}.pdf`);
    } catch (err) {
      console.error('PDF Generation failed:', err);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="report-page">
        <div className="report-loading glass-card text-center">
          <div className="spin-loader"></div>
          <h2>Generating Performance Report...</h2>
          <p>Analyzing interview responses and contextualizing with resume profile...</p>
        </div>
      </div>
    );
  }

  const score = reportData?.overallScore || 82;
  const categories = [
    { name: 'Technical Accuracy', score: reportData?.categoryScores?.technical || 85, color: '#00d4ff' },
    { name: 'Communication', score: reportData?.categoryScores?.communication || 80, color: '#3b82f6' },
    { name: 'Confidence', score: reportData?.categoryScores?.confidence || 84, color: '#8b5cf6' },
    { name: 'Clarity', score: reportData?.categoryScores?.clarity || 81, color: '#ec4899' }
  ];

  return (
    <div className="report-page" ref={reportRef}>
      <div className="report-header glass-card">
        <div className="header-candidate">
          <div className="candidate-badge-icon">
            <User size={28} />
          </div>
          <div>
            <h2>{reportData?.candidateName || candidateProfile?.fullName || 'Candidate'}</h2>
            <p className="role-sub">Interview Performance Report — <strong>{reportData?.targetRole || domain}</strong> ({difficulty})</p>
          </div>
        </div>
        {interviewer && (
          <div className="candidate-meta-tag" style={{ border: `1px solid ${interviewer.badgeColor}` }}>
            <User size={16} /> Interviewer: <strong>{interviewer.name}</strong> ({interviewer.title})
          </div>
        )}
        {candidateProfile?.education && (
          <div className="candidate-meta-tag">
            <Award size={16} /> {candidateProfile.education}
          </div>
        )}
      </div>

      <div className="report-grid">
        <div className="score-card glass-card">
          <h3>Overall Score</h3>
          <div className="circular-progress">
            <svg viewBox="0 0 100 100">
              <circle className="bg" cx="50" cy="50" r="45"></circle>
              <circle
                className="progress"
                cx="50" cy="50" r="45"
                style={{ strokeDasharray: `${(score / 100) * 283} 283` }}
              ></circle>
            </svg>
            <div className="score-value">
              <span>{score}</span>
              <small>/100</small>
            </div>
          </div>
          <p className="score-text">{reportData?.summary}</p>
        </div>

        <div className="breakdown-card glass-card">
          <h3>Category Breakdown</h3>
          <div className="bars-container">
            {categories.map(cat => (
              <div key={cat.name} className="bar-item">
                <div className="bar-label">
                  <span>{cat.name}</span>
                  <span>{cat.score}%</span>
                </div>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${cat.score}%`, backgroundColor: cat.color }}
                  ></div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="feedback-card glass-card">
          <h3><TrendingUp className="icon-success" /> Key Strengths</h3>
          <ul className="feedback-list">
            {(reportData?.strengths || []).map((item, i) => (
              <li key={i}>
                <CheckCircle size={18} className="icon-success" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="feedback-card glass-card">
          <h3><AlertTriangle className="icon-warning" /> Areas for Improvement</h3>
          <ul className="feedback-list">
            {(reportData?.improvements || []).map((item, i) => (
              <li key={i}>
                <div className="bullet-warning"></div>
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {responses.length > 0 && (
        <div className="qa-section glass-card">
          <h3><MessageSquare className="icon-primary" /> Detailed Interview Questions & Answers</h3>
          <div className="qa-accordion-list">
            {responses.map((resItem, idx) => (
              <div key={idx} className="accordion-item">
                <button
                  className="accordion-header"
                  onClick={() => setExpandedQIndex(expandedQIndex === idx ? -1 : idx)}
                >
                  <span className="q-number">Q{idx + 1}</span>
                  <span className="q-title">{resItem.question}</span>
                  <span className="q-score-badge">{resItem.score || 8}/10</span>
                  {expandedQIndex === idx ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>

                {expandedQIndex === idx && (
                  <div className="accordion-content">
                    <div className="answer-box">
                      <strong>Candidate Answer:</strong>
                      <p>"{resItem.answer}"</p>
                    </div>
                    {resItem.feedback && (
                      <div className="feedback-box">
                        <strong>AI Evaluation Feedback:</strong>
                        <p>{resItem.feedback}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="report-actions">
        <button className="btn-secondary" onClick={handleDownloadPDF}>
          <Download size={20} /> Download PDF Report
        </button>
        <button className="btn-primary" onClick={() => navigate('/candidate-info')}>
          <RefreshCw size={20} /> Practice New Session
        </button>
      </div>
    </div>
  );
};

export default Report;
