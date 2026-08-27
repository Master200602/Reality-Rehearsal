import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Mail, MapPin, GraduationCap, Briefcase, Target, UploadCloud, CheckCircle2, FileText, AlertCircle, ArrowRight, Loader2, Zap, List } from 'lucide-react';
import { uploadResume, analyzeResume } from '../services/api';
import './CandidateInfo.css';

const CandidateInfo = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    city: '',
    college: '',
    degree: 'B.Tech / B.E.',
    branch: 'Computer Science & Engineering',
    graduationYear: new Date().getFullYear(),
    experienceYears: '0',
    currentRole: '',
    targetRole: 'Software Engineer',
  });

  const [difficulty, setDifficulty] = useState('Medium');
  const [questionsCount, setQuestionsCount] = useState(5);

  const [resumeFile, setResumeFile] = useState(null);
  const [resumeText, setResumeText] = useState('');
  const [resumeAnalysis, setResumeAnalysis] = useState(null);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle | uploading | analyzed | error
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleFileChange = async (file) => {
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setErrorMessage('Only PDF format resumes are allowed. Please select a valid PDF file.');
      setUploadStatus('error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage('File size exceeds maximum limit of 5MB.');
      setUploadStatus('error');
      return;
    }

    setResumeFile(file);
    setUploadStatus('uploading');
    setErrorMessage('');

    try {
      const uploadRes = await uploadResume(file);

      // Check if backend returned a rejection (NOT_A_RESUME, INSUFFICIENT_CONTENT, etc.)
      if (uploadRes.error) {
        setErrorMessage(uploadRes.message || 'This file was rejected. Please upload a valid resume PDF.');
        setUploadStatus('error');
        setResumeFile(null);
        setResumeText('');
        return;
      }

      const text = uploadRes.extractedText;
      if (!text || text.length < 50) {
        setErrorMessage("Couldn't extract readable text from this PDF. Please upload a text-based resume PDF (not a scanned image).");
        setUploadStatus('error');
        setResumeFile(null);
        setResumeText('');
        return;
      }

      setResumeText(text);

      const analysisRes = await analyzeResume(text, formData.targetRole);
      setResumeAnalysis(analysisRes);
      setUploadStatus('analyzed');
    } catch (err) {
      console.warn('Resume upload error:', err);

      // Extract error message from API response if available
      const apiError = err?.response?.data;
      if (apiError?.error && apiError?.message) {
        setErrorMessage(apiError.message);
        setUploadStatus('error');
        setResumeFile(null);
        setResumeText('');
        return;
      }

      // Network error or server completely down — show a clear message, don't silently continue
      setErrorMessage('Could not connect to the server to process your resume. Please check your connection and try again.');
      setUploadStatus('error');
      setResumeFile(null);
      setResumeText('');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileChange(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!formData.fullName.trim()) {
      setErrorMessage('Full Name is required.');
      return;
    }
    if (!formData.email.trim()) {
      setErrorMessage('Email Address is required.');
      return;
    }
    if (!formData.city.trim()) {
      setErrorMessage('City / Location is required.');
      return;
    }
    if (!formData.college.trim()) {
      setErrorMessage('College / University name is required.');
      return;
    }
    if (!formData.degree.trim()) {
      setErrorMessage('Degree is required.');
      return;
    }
    if (!formData.branch.trim()) {
      setErrorMessage('Branch / Specialization is required.');
      return;
    }
    if (!formData.targetRole.trim()) {
      setErrorMessage('Target Job Role / Domain is required.');
      return;
    }

    if (!resumeFile || uploadStatus !== 'analyzed') {
      setErrorMessage('Resume upload is COMPULSORY. Please attach your PDF resume to proceed.');
      return;
    }

    setIsSubmitting(true);

    const candidateProfile = {
      ...formData,
      skills: resumeAnalysis?.skills || [formData.branch, formData.targetRole],
      projects: resumeAnalysis?.projects || ['Academic & Technical Projects'],
      summary: resumeAnalysis?.summary || `Candidate applying for ${formData.targetRole} from ${formData.city}`,
      education: `${formData.degree} in ${formData.branch} (${formData.graduationYear}) - ${formData.college}`,
    };

    setTimeout(() => {
      setIsSubmitting(false);
      navigate('/interview', {
        state: {
          domain: formData.targetRole || 'Software Engineering',
          difficulty,
          questionsCount,
          candidateProfile,
          resumeText,
        },
      });
    }, 600);
  };

  return (
    <div className="candidate-page">
      <div className="candidate-container">
        
        <div className="candidate-header text-center">
          <h2>Candidate Registration & Resume Upload</h2>
          <p>Complete all mandatory fields and attach your resume PDF to start your personalized AI voice interview</p>
        </div>

        <form onSubmit={handleSubmit} className="candidate-form-layout">
          
          <div className="form-section glass-card">
            <h3><User className="section-icon" /> Mandatory Candidate Information</h3>

            <div className="form-grid">
              <div className="form-group full-width">
                <label><User className="label-icon" /> Full Name <span className="req-star">*</span></label>
                <input
                  type="text"
                  name="fullName"
                  placeholder="e.g. Alex Johnson"
                  value={formData.fullName}
                  onChange={handleInputChange}
                  required
                  className="custom-input highlight-input"
                />
              </div>

              <div className="form-group">
                <label><Mail className="label-icon" /> Email Address <span className="req-star">*</span></label>
                <input
                  type="email"
                  name="email"
                  placeholder="alex@example.com"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="custom-input"
                />
              </div>

              <div className="form-group">
                <label><MapPin className="label-icon" /> City / Location <span className="req-star">*</span></label>
                <input
                  type="text"
                  name="city"
                  placeholder="e.g. Mumbai, New York, London"
                  value={formData.city}
                  onChange={handleInputChange}
                  required
                  className="custom-input"
                />
              </div>

              <div className="form-group full-width">
                <label><Target className="label-icon" /> Target Job Role / Domain <span className="req-star">*</span></label>
                <input
                  type="text"
                  name="targetRole"
                  placeholder="e.g. Full-Stack Developer, Data Scientist, ML Engineer"
                  value={formData.targetRole}
                  onChange={handleInputChange}
                  required
                  className="custom-input"
                />
              </div>

              <div className="form-group full-width">
                <label><GraduationCap className="label-icon" /> College / University <span className="req-star">*</span></label>
                <input
                  type="text"
                  name="college"
                  placeholder="e.g. National Institute of Technology / Stanford"
                  value={formData.college}
                  onChange={handleInputChange}
                  required
                  className="custom-input"
                />
              </div>

              <div className="form-group">
                <label><GraduationCap className="label-icon" /> Degree <span className="req-star">*</span></label>
                <input
                  type="text"
                  name="degree"
                  placeholder="e.g. B.Tech / B.E. / M.S. / B.C.A."
                  value={formData.degree}
                  onChange={handleInputChange}
                  required
                  className="custom-input"
                />
              </div>

              <div className="form-group">
                <label><GraduationCap className="label-icon" /> Branch / Specialization <span className="req-star">*</span></label>
                <input
                  type="text"
                  name="branch"
                  placeholder="e.g. Computer Science / AI / Data Science"
                  value={formData.branch}
                  onChange={handleInputChange}
                  required
                  className="custom-input"
                />
              </div>

              <div className="form-group">
                <label>Graduation Year <span className="req-star">*</span></label>
                <input
                  type="number"
                  name="graduationYear"
                  min="2015"
                  max="2032"
                  value={formData.graduationYear}
                  onChange={handleInputChange}
                  required
                  className="custom-input"
                />
              </div>

              <div className="form-group">
                <label><Briefcase className="label-icon" /> Experience Level</label>
                <select
                  name="experienceYears"
                  value={formData.experienceYears}
                  onChange={handleInputChange}
                  className="custom-select"
                >
                  <option value="0">Fresher (0 years)</option>
                  <option value="1">1 Year</option>
                  <option value="2">2 Years</option>
                  <option value="3">3-5 Years</option>
                  <option value="5+">5+ Years</option>
                </select>
              </div>
            </div>
          </div>

          <div className="upload-section glass-card">
            <h3><FileText className="section-icon" /> Resume Upload (PDF) <span className="req-star">*</span></h3>
            <p className="upload-subtitle">Resume upload is compulsory. Attach your PDF resume so the AI can tailor questions to your real projects.</p>

            <div
              className={`dropzone ${uploadStatus === 'analyzed' ? 'dropzone-success' : ''} ${uploadStatus === 'error' ? 'dropzone-error' : ''}`}
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
            >
              {uploadStatus === 'uploading' ? (
                <div className="dropzone-state">
                  <Loader2 size={40} className="spin text-primary" />
                  <p className="state-text">Processing and analyzing resume PDF...</p>
                </div>
              ) : uploadStatus === 'analyzed' ? (
                <div className="dropzone-state">
                  <CheckCircle2 size={44} className="text-success" />
                  <p className="file-name">{resumeFile?.name}</p>
                  <p className="state-subtitle">Resume PDF uploaded & attached successfully! ✅</p>
                  {resumeAnalysis?.skills && (
                    <div className="skills-tags">
                      {resumeAnalysis.skills.slice(0, 6).map((skill, i) => (
                        <span key={i} className="skill-tag">{skill}</span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="dropzone-state">
                  <UploadCloud size={44} className="upload-icon" />
                  <p className="state-text">Drag & drop your PDF resume here, or <span className="browse-link">browse file</span></p>
                  <span className="file-hint">PDF format compulsory (Max size 5MB)</span>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => e.target.files && handleFileChange(e.target.files[0])}
                    className="file-input-hidden"
                  />
                </div>
              )}
            </div>

            <div className="session-quick-config">
              <div className="form-group">
                <label><Zap className="label-icon" /> Difficulty Level</label>
                <div className="difficulty-toggles">
                  {['Easy', 'Medium', 'Hard'].map(level => (
                    <button
                      key={level}
                      type="button"
                      className={`toggle-btn ${difficulty === level ? 'active' : ''}`}
                      onClick={() => setDifficulty(level)}
                    >
                      {level}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>
                  <span><List className="label-icon" /> Questions Count: <strong>{questionsCount}</strong></span>
                </label>
                <input
                  type="range"
                  min="3"
                  max="10"
                  value={questionsCount}
                  onChange={(e) => setQuestionsCount(parseInt(e.target.value))}
                  className="custom-slider"
                />
              </div>
            </div>

            {errorMessage && (
              <div className="error-banner">
                <AlertCircle size={18} />
                <span>{errorMessage}</span>
              </div>
            )}

            <button type="submit" className="btn-primary start-btn" disabled={isSubmitting}>
              {isSubmitting ? (
                <>Preparing AI Voice Interview... <Loader2 size={20} className="spin" /></>
              ) : (
                <>Start AI Voice Interview <ArrowRight size={20} /></>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CandidateInfo;
