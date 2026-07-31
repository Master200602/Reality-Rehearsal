import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Download, RefreshCw, CheckCircle, TrendingUp, AlertTriangle, ChevronDown, ChevronUp, Loader, FileText } from 'lucide-react';
import { generateReport } from '../services/api';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import './Report.css';

const Report = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { domain = 'General', difficulty = 'Medium', responses = [] } = location.state || {};

  const [report, setReport] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedQ, setExpandedQ] = useState(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const reportRef = useRef(null);

  // ─── Fetch report from API on mount ───
  useEffect(() => {
    const fetchReport = async () => {
      try {
        const data = await generateReport({
          domain,
          difficulty,
          responses: responses.map(r => ({
            question: r.question,
            answer: r.answer,
            score: r.score,
          })),
        });
        setReport(data);
      } catch (err) {
        console.error('Failed to generate report:', err);
        // Fallback: compute from local responses
        const avgScore = responses.length > 0
          ? Math.round(responses.reduce((sum, r) => sum + (r.score || 0), 0) / responses.length * 10)
          : 0;
        setReport({
          overallScore: avgScore,
          summary: 'Report generated from local evaluation data.',
          categoryScores: {
            technical: avgScore,
            communication: Math.max(avgScore - 5, 0),
            confidence: Math.max(avgScore + 5, 0),
            clarity: avgScore,
          },
          detailedFeedback: 'Unable to reach the AI server for a comprehensive report. Scores below are computed from individual answer evaluations.',
          recommendations: ['Ensure your backend is running for full AI-generated reports.'],
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchReport();
  }, []);

  // ─── Compute category bars ───
  const categories = report ? [
    { name: 'Technical Accuracy', score: report.categoryScores?.technical * 10 || 0, color: '#10b981' },
    { name: 'Communication', score: report.categoryScores?.communication * 10 || 0, color: '#3b82f6' },
    { name: 'Confidence', score: report.categoryScores?.confidence * 10 || 0, color: '#8b5cf6' },
    { name: 'Clarity', score: report.categoryScores?.clarity * 10 || 0, color: '#ec4899' },
  ] : [];

  const overallPercent = report ? report.overallScore * 10 : 0;

  // ─── PDF Download ───
  const handleDownloadPDF = async () => {
    if (!reportRef.current) return;
    setIsDownloading(true);

    try {
      const canvas = await html2canvas(reportRef.current, {
        backgroundColor: '#0a0a1a',
        scale: 2,
        useCORS: true,
        logging: false,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

      // If content is taller than one page, add multiple pages
      const pageHeight = pdf.internal.pageSize.getHeight();
      let heightLeft = pdfHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - pdfHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`Reality-Rehearsal_${domain}_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  // ─── Loading state ───
  if (isLoading) {
    return (
      <div className="report-page">
        <div className="loading-card glass-card">
          <Loader size={48} className="spin" />
          <h2>Generating Your Report</h2>
          <p>AI is analyzing your interview performance...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="report-page">
      <div ref={reportRef} className="report-content">
        <div className="report-header">
          <h2>Interview Performance Report</h2>
          <p>{domain} • {difficulty} • {responses.length} questions answered</p>
        </div>

        <div className="report-grid">
          {/* Overall Score */}
          <div className="score-card glass-card">
            <h3>Overall Score</h3>
            <div className="circular-progress">
              <svg viewBox="0 0 100 100">
                <circle className="bg" cx="50" cy="50" r="45"></circle>
                <circle
                  className="progress"
                  cx="50" cy="50" r="45"
                  style={{ strokeDasharray: `${(overallPercent / 100) * 283} 283` }}
                ></circle>
              </svg>
              <div className="score-value">
                <span>{overallPercent}</span>
                <small>/100</small>
              </div>
            </div>
            <p className="score-text">{report?.summary || ''}</p>
          </div>

          {/* Category Breakdown */}
          <div className="breakdown-card glass-card">
            <h3>Category Breakdown</h3>
            <div className="bars-container">
              {categories.map(cat => (
                <div key={cat.name} className="bar-item">
                  <div className="bar-label">
                    <span>{cat.name}</span>
                    <span>{Math.min(cat.score, 100)}%</span>
                  </div>
                  <div className="bar-track">
                    <div
                      className="bar-fill"
                      style={{ width: `${Math.min(cat.score, 100)}%`, backgroundColor: cat.color }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Detailed Feedback */}
          {report?.detailedFeedback && (
            <div className="detailed-feedback glass-card">
              <h3><FileText size={20} /> Detailed Feedback</h3>
              <p>{report.detailedFeedback}</p>
            </div>
          )}

          {/* Recommendations */}
          {report?.recommendations?.length > 0 && (
            <div className="feedback-card glass-card">
              <h3><TrendingUp className="icon-success" /> Recommendations</h3>
              <ul className="feedback-list">
                {report.recommendations.map((item, i) => (
                  <li key={i}>
                    <CheckCircle size={18} className="icon-success" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* ─── Individual Q&A Breakdown ─── */}
        {responses.length > 0 && (
          <div className="qa-section">
            <h3>Question-by-Question Breakdown</h3>
            <div className="qa-list">
              {responses.map((r, i) => (
                <div key={i} className="qa-item glass-card">
                  <button
                    className="qa-header"
                    onClick={() => setExpandedQ(expandedQ === i ? null : i)}
                  >
                    <div className="qa-header-left">
                      <span className="qa-number">Q{i + 1}</span>
                      <span className="qa-question-preview">
                        {r.question.length > 80 ? r.question.slice(0, 80) + '...' : r.question}
                      </span>
                    </div>
                    <div className="qa-header-right">
                      <span className={`qa-score ${r.score >= 7 ? 'good' : r.score >= 4 ? 'okay' : 'low'}`}>
                        {r.score}/10
                      </span>
                      {expandedQ === i ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </div>
                  </button>

                  {expandedQ === i && (
                    <div className="qa-details">
                      <div className="qa-detail-row">
                        <strong>Question:</strong>
                        <p>{r.question}</p>
                      </div>
                      <div className="qa-detail-row">
                        <strong>Your Answer:</strong>
                        <p className="qa-answer">{r.answer}</p>
                      </div>
                      {r.feedback && (
                        <div className="qa-detail-row">
                          <strong>Feedback:</strong>
                          <p>{r.feedback}</p>
                        </div>
                      )}
                      {r.strengths?.length > 0 && (
                        <div className="qa-detail-row">
                          <strong>✅ Strengths:</strong>
                          <ul>{r.strengths.map((s, j) => <li key={j}>{s}</li>)}</ul>
                        </div>
                      )}
                      {r.improvements?.length > 0 && (
                        <div className="qa-detail-row">
                          <strong>💡 Areas to Improve:</strong>
                          <ul>{r.improvements.map((s, j) => <li key={j}>{s}</li>)}</ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Actions — outside reportRef so they don't appear in PDF */}
      <div className="report-actions">
        <button className="btn-secondary" onClick={handleDownloadPDF} disabled={isDownloading}>
          {isDownloading ? <Loader size={20} className="spin" /> : <Download size={20} />}
          {isDownloading ? 'Generating PDF...' : 'Download PDF'}
        </button>
        <button className="btn-primary" onClick={() => navigate('/setup')}>
          <RefreshCw size={20} /> Practice Again
        </button>
      </div>
    </div>
  );
};

export default Report;
