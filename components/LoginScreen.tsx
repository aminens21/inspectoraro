
import React, { useState, useEffect } from 'react';
import { useTranslations } from '../hooks/useTranslations';

interface LoginScreenProps {
  onLogin: (name: string, remember: boolean) => void;
  ministryLogo: string;
  initialName: string;
  correctPassword?: string;
  onShowAbout: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLogin, ministryLogo, initialName, correctPassword, onShowAbout }) => {
  const { t, theme, toggleTheme } = useTranslations();
  const [name, setName] = useState(initialName);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');

  // Update name state when initialName prop changes (e.g. after loading from localStorage)
  useEffect(() => {
    if (initialName) {
        setName(initialName);
    }
  }, [initialName]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const actualPassword = correctPassword || '3lachbghitih@';
    
    if (password === actualPassword) {
      onLogin(name, rememberMe);
    } else {
      setError(t('login_errorPassword'));
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[rgb(var(--color-background))] p-4">
      <div className="relative bg-[rgb(var(--color-card))] p-8 rounded-2xl shadow-xl w-full max-w-md border border-[rgb(var(--color-border))]">
        
        {/* Action Buttons: Inside Card, Top Left, Vertical */}
        <div className="absolute top-4 left-4 flex flex-col gap-2 z-10">
            <button
              onClick={toggleTheme}
              className="p-2 h-9 w-9 flex items-center justify-center rounded-lg bg-[rgb(var(--color-button-secondary-bg))] text-[rgb(var(--color-text-base))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))] transition-colors shadow-sm border border-[rgb(var(--color-border))]"
              aria-label={theme.startsWith('light') ? t('themeSwitcher_toDark') : t('themeSwitcher_toLight')}
            >
              {theme.startsWith('light') ? (
                <i className="fas fa-moon"></i>
              ) : (
                <i className="fas fa-lightbulb"></i>
              )}
            </button>

            <button
                onClick={onShowAbout}
                className="p-2 h-9 w-9 flex items-center justify-center rounded-lg bg-[rgb(var(--color-button-secondary-bg))] text-[rgb(var(--color-text-base))] hover:bg-[rgb(var(--color-button-secondary-hover-bg))] transition-colors shadow-sm border border-[rgb(var(--color-border))]"
                title={t('about_tooltip')}
              >
                <i className="fas fa-question-circle"></i>
            </button>
        </div>

        <div className="text-center mb-8">
           <img src={ministryLogo} alt={t('ministryLogoAlt')} className="h-[80px] mx-auto mb-4" />
           <h1 className="text-2xl font-bold text-[rgb(var(--color-text-base))]">{t('login_title')}</h1>
           <p className="text-[rgb(var(--color-text-muted))] mt-2 text-sm">{t('login_subTitle')}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-[rgb(var(--color-text-base))] mb-2">{t('login_nameLabel')}</label>
            <div className="relative">
                <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-[rgb(var(--color-text-muted))]">
                    <i className="fas fa-user"></i>
                </span>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-style w-full pr-10"
                  placeholder={t('login_placeholderName')}
                  required
                />
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[rgb(var(--color-text-base))] mb-2">{t('login_passwordLabel')}</label>
            <div className="relative">
                 <span className="absolute inset-y-0 right-0 flex items-center pr-3 text-[rgb(var(--color-text-muted))]">
                    <i className="fas fa-lock"></i>
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setError(''); setPassword(e.target.value); }}
                  className="input-style w-full pr-10 pl-10" // Padding for icon and eye
                  placeholder={t('login_placeholderPassword')}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 left-0 flex items-center pl-3 text-[rgb(var(--color-text-muted))] hover:text-sky-600 focus:outline-none"
                >
                  <i className={`fas ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                </button>
            </div>
            {error && <p className="text-rose-500 text-xs mt-2 font-bold">{error}</p>}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 text-sky-600 rounded border-gray-300 focus:ring-sky-500"
            />
            <label htmlFor="rememberMe" className="text-sm font-medium text-[rgb(var(--color-text-base))] cursor-pointer">
              {t('login_rememberMe')}
            </label>
          </div>

          <button
            type="submit"
            className="w-full bg-sky-600 hover:bg-sky-700 text-white font-bold py-3 rounded-xl transition-all shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            {t('login_button')}
          </button>
        </form>
      </div>
    </div>
  );
};
