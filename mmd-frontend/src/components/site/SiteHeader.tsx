import { useState } from 'react'
import { navigateToLauncher } from '../../app/inAppNavigation'
import { useAuth } from '../../hooks/useAuth'

export interface SiteHeaderProps {
  /** Current view mode for context-aware display */
  mode?: 'launcher' | 'host' | 'room' | 'play'
  /** Override default branding link behavior */
  onBrandClick?: () => void
}

export function SiteHeader({ onBrandClick }: SiteHeaderProps) {
  const { user, isLoading, login, logout: _logout } = useAuth()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const handleBrandClick = () => {
    if (onBrandClick) {
      onBrandClick()
    } else {
      navigateToLauncher()
    }
  }

  const handleAvatarClick = () => {
    if (isLoading) return
    if (!user) void login()
  }

  return (
    <header className="site-header">
      <div className="site-header__container">
        {/* Branding Section */}
        <div className="site-header__brand">
          <button 
            className="site-header__brand-link"
            onClick={handleBrandClick}
            aria-label="Go to homepage"
          >
            {/* Temporary Logo */}
            <div className="site-header__logo">
              <div className="site-header__logo-placeholder">
                MMD
              </div>
            </div>
            
            {/* Stacked Text Branding */}
            <div className="site-header__brand-text">
              <span className="site-header__brand-line">MURDER</span>
              <span className="site-header__brand-line">MYSTERY</span>
              <span className="site-header__brand-line">DINNER</span>
            </div>
          </button>
        </div>

        {/* User Section */}
        <div className="site-header__user">
          <button 
            className="site-header__avatar"
            type="button"
            onClick={handleAvatarClick}
            disabled={isLoading}
            aria-label={isLoading ? 'Loading account' : user ? 'Sign out' : 'Sign in'}
          >
            {user?.avatar ? (
              <img 
                src={user.avatar} 
                alt={user.name || 'User avatar'} 
                className="site-header__avatar-img"
              />
            ) : (
              <div className="site-header__avatar-placeholder">
                {/* Default avatar icon */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              </div>
            )}
          </button>
        </div>

        {/* Mobile Menu Toggle */}
        <button 
          className="site-header__menu-toggle"
          onClick={() => setIsMenuOpen(!isMenuOpen)}
          aria-label="Toggle menu"
        >
          <span className="site-header__menu-icon"></span>
        </button>
      </div>

      {/* Mobile Menu (hidden by default) */}
      {isMenuOpen && (
        <div className="site-header__mobile-menu">
          <div className="site-header__mobile-menu-content">
            <button 
              className="site-header__mobile-menu-item"
              onClick={handleBrandClick}
            >
              Home
            </button>
            {/* Future menu items can be added here */}
          </div>
        </div>
      )}
    </header>
  )
}
