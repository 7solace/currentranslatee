import React, { useState, useEffect, useRef } from 'react';
import './App.css';

const App = () => {
  const [sourceText, setSourceText] = useState('');
  const [translation, setTranslation] = useState(null);
  const [fromLang, setFromLang] = useState('tr');
  const [toLang, setToLang] = useState('en');
  const [languages, setLanguages] = useState({});
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedAlternative, setSelectedAlternative] = useState('');
  const [error, setError] = useState('');
  const textareaRef = useRef(null);

  const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:8001';

  // Load languages on component mount
  useEffect(() => {
    fetchLanguages();
    fetchHistory();
  }, []);

  // Keyboard shortcut for translation
  useEffect(() => {
    const handleKeyPress = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        handleTranslate();
      }
    };

    document.addEventListener('keydown', handleKeyPress);
    return () => document.removeEventListener('keydown', handleKeyPress);
  }, [sourceText, fromLang, toLang]);

  const fetchLanguages = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/languages`);
      const data = await response.json();
      setLanguages(data.languages);
    } catch (error) {
      console.error('Failed to fetch languages:', error);
      setError('Dil listesi yüklenirken hata oluştu');
    }
  };

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/history`);
      const data = await response.json();
      setHistory(data.translations || []);
    } catch (error) {
      console.error('Failed to fetch history:', error);
    }
  };

  const handleTranslate = async () => {
    if (!sourceText.trim()) {
      setError('Lütfen çevrilecek metni girin');
      return;
    }

    if (fromLang === toLang) {
      setError('Kaynak ve hedef dil aynı olamaz');
      return;
    }

    if (sourceText.length > 5000) {
      setError('Metin çok uzun (maksimum 5000 karakter)');
      return;
    }

    setLoading(true);
    setError('');
    setTranslation(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/translate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: sourceText,
          from_lang: fromLang,
          to_lang: toLang,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Çeviri başarısız');
      }

      const data = await response.json();
      setTranslation(data);
      setSelectedAlternative(data.main_translation);
      fetchHistory(); // Refresh history
    } catch (error) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const swapLanguages = () => {
    const tempLang = fromLang;
    setFromLang(toLang);
    setToLang(tempLang);
    
    // Swap text if there's a translation
    if (translation) {
      setSourceText(selectedAlternative);
      setTranslation(null);
      setSelectedAlternative('');
    }
  };

  const clearHistory = async () => {
    try {
      await fetch(`${BACKEND_URL}/api/history`, { method: 'DELETE' });
      setHistory([]);
    } catch (error) {
      console.error('Failed to clear history:', error);
    }
  };

  const loadHistoryItem = (item) => {
    setSourceText(item.text);
    setFromLang(item.from_lang);
    setToLang(item.to_lang);
    setTranslation(item);
    setSelectedAlternative(item.main_translation);
    setShowHistory(false);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 via-purple-900 to-pink-900">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-purple-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-blue-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-pink-500 rounded-full mix-blend-multiply filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
      </div>

      {/* Main Container */}
      <div className="relative z-10 container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-white mb-4 bg-gradient-to-r from-blue-400 to-purple-600 bg-clip-text text-transparent">
            🌍 AI Translator Pro
          </h1>
          <p className="text-xl text-white/80 max-w-2xl mx-auto">
            Gelişmiş yapay zeka ile bağlamına uygun çeviriler ve alternatif seçenekler
          </p>
        </div>

        {/* Main Translation Interface */}
        <div className="max-w-6xl mx-auto">
          {/* Language Selector */}
          <div className="glass-card p-6 mb-6">
            <div className="flex items-center justify-center gap-4 flex-wrap">
              <select
                value={fromLang}
                onChange={(e) => setFromLang(e.target.value)}
                className="glass-select"
              >
                {Object.entries(languages).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>

              <button
                onClick={swapLanguages}
                className="swap-btn"
                title="Dilleri değiştir"
              >
                ⇄
              </button>

              <select
                value={toLang}
                onChange={(e) => setToLang(e.target.value)}
                className="glass-select"
              >
                {Object.entries(languages).map(([code, name]) => (
                  <option key={code} value={code}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Translation Areas */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            {/* Source Text */}
            <div className="glass-card p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">
                  {languages[fromLang] || 'Kaynak Dil'}
                </h3>
                <span className="text-sm text-white/60">
                  {sourceText.length}/5000
                </span>
              </div>
              <textarea
                ref={textareaRef}
                value={sourceText}
                onChange={(e) => setSourceText(e.target.value)}
                placeholder="Çevrilecek metni buraya yazın... (Ctrl+Enter ile çevir)"
                className="glass-textarea"
                rows="8"
                maxLength={5000}
              />
            </div>

            {/* Translation Result */}
            <div className="glass-card p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-white">
                  {languages[toLang] || 'Hedef Dil'}
                </h3>
                {selectedAlternative && (
                  <button
                    onClick={() => copyToClipboard(selectedAlternative)}
                    className="copy-btn"
                    title="Kopyala"
                  >
                    📋
                  </button>
                )}
              </div>
              
              {loading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="loading-spinner"></div>
                  <span className="ml-3 text-white">Çevriliyor...</span>
                </div>
              ) : selectedAlternative ? (
                <div className="glass-textarea-result">
                  {selectedAlternative}
                </div>
              ) : (
                <div className="glass-textarea-placeholder">
                  Çeviri burada görünecek...
                </div>
              )}
            </div>
          </div>

          {/* Translate Button */}
          <div className="text-center mb-6">
            <button
              onClick={handleTranslate}
              disabled={loading || !sourceText.trim()}
              className="translate-btn"
            >
              {loading ? (
                <>
                  <div className="loading-spinner-small"></div>
                  Çevriliyor...
                </>
              ) : (
                <>
                  🚀 Çevir
                  <span className="ml-2 text-sm opacity-75">(Ctrl+Enter)</span>
                </>
              )}
            </button>
          </div>

          {/* Error Message */}
          {error && (
            <div className="error-message mb-6">
              ⚠️ {error}
            </div>
          )}

          {/* Alternative Translations */}
          {translation && translation.alternatives && translation.alternatives.length > 0 && (
            <div className="glass-card p-6 mb-6">
              <h3 className="text-xl font-semibold text-white mb-4">
                🎯 Alternatif Çeviriler
              </h3>
              <div className="space-y-4">
                {/* Main Translation */}
                <div
                  className={`alternative-card ${
                    selectedAlternative === translation.main_translation ? 'selected' : ''
                  }`}
                  onClick={() => setSelectedAlternative(translation.main_translation)}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="font-medium text-white mb-1">
                        ✨ Ana Çeviri (Önerilen)
                      </div>
                      <div className="text-white/90">
                        {translation.main_translation}
                      </div>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(translation.main_translation);
                      }}
                      className="copy-btn-small"
                    >
                      📋
                    </button>
                  </div>
                </div>

                {/* Alternatives */}
                {translation.alternatives.map((alt, index) => (
                  <div
                    key={index}
                    className={`alternative-card ${
                      selectedAlternative === alt.translation ? 'selected' : ''
                    }`}
                    onClick={() => setSelectedAlternative(alt.translation)}
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="context-badge">
                            {alt.context}
                          </span>
                        </div>
                        <div className="text-white/90 mb-2">
                          {alt.translation}
                        </div>
                        <div className="text-sm text-white/60">
                          {alt.explanation}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(alt.translation);
                        }}
                        className="copy-btn-small"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* History Section */}
          <div className="glass-card p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold text-white">
                📚 Çeviri Geçmişi
              </h3>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className="history-toggle-btn"
                >
                  {showHistory ? 'Gizle' : 'Göster'}
                </button>
                {history.length > 0 && (
                  <button
                    onClick={clearHistory}
                    className="clear-btn"
                  >
                    🗑️ Temizle
                  </button>
                )}
              </div>
            </div>

            {showHistory && (
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {history.length === 0 ? (
                  <div className="text-center text-white/60 py-8">
                    Henüz çeviri geçmişi yok
                  </div>
                ) : (
                  history.map((item) => (
                    <div
                      key={item.id}
                      className="history-item"
                      onClick={() => loadHistoryItem(item)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="history-lang">
                              {languages[item.from_lang]} → {languages[item.to_lang]}
                            </span>
                            <span className="history-time">
                              {new Date(item.timestamp).toLocaleString('tr-TR')}
                            </span>
                          </div>
                          <div className="text-white/80 text-sm mb-1">
                            "{item.text.length > 100 ? item.text.substring(0, 100) + '...' : item.text}"
                          </div>
                          <div className="text-white/60 text-sm">
                            → {item.main_translation.length > 100 ? 
                                item.main_translation.substring(0, 100) + '...' : 
                                item.main_translation}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center mt-12 text-white/60">
          <p>Made with ❤️ using Google Gemini • Fast, Free, Context-Aware</p>
        </div>
      </div>
    </div>
  );
};

export default App;