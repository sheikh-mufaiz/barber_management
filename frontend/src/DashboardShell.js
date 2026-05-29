import React from "react";

function DashboardShell({
  theme = "default",
  eyebrow,
  title,
  description,
  contextLabel,
  contextValue,
  actions,
  navigation,
  activeSection,
  onSectionChange,
  summaryCards,
  children
}) {
  return (
    <div className={`dashboard-shell dashboard-shell--${theme}`}>
      <header className="dashboard-shell__hero">
        <div className="dashboard-shell__hero-glow" aria-hidden="true" />
        <div className="dashboard-shell__hero-copy">
          {eyebrow ? <p className="dashboard-shell__eyebrow">{eyebrow}</p> : null}
          <h1 className="dashboard-shell__title">{title}</h1>
          {description ? <p className="dashboard-shell__description">{description}</p> : null}
        </div>

        {(contextValue || actions) && (
          <div className="dashboard-shell__meta">
            {contextValue ? (
              <div className="dashboard-shell__context">
                {contextLabel ? (
                  <span className="dashboard-shell__context-label">{contextLabel}</span>
                ) : null}
                <strong className="dashboard-shell__context-value">{contextValue}</strong>
              </div>
            ) : null}

            {actions ? <div className="dashboard-shell__actions">{actions}</div> : null}
          </div>
        )}
      </header>

      {summaryCards?.length ? (
        <section className="dashboard-summary" aria-label="Dashboard summary">
          {summaryCards.map((card) => (
            <article className="dashboard-summary-card" key={card.label}>
              <p className="dashboard-summary-card__label">{card.label}</p>
              <strong className="dashboard-summary-card__value">{card.value}</strong>
              {card.hint ? <span className="dashboard-summary-card__hint">{card.hint}</span> : null}
            </article>
          ))}
        </section>
      ) : null}

      {navigation?.length ? (
        <div className="dashboard-shell__nav-wrap">
          <div className="dashboard-nav" role="tablist" aria-label={`${title} sections`}>
            {navigation.map((section) => (
              <button
                key={section.id}
                className={`dashboard-nav__button ${
                  activeSection === section.id ? "dashboard-nav__button--active" : ""
                }`}
                onClick={() => onSectionChange(section.id)}
                type="button"
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="dashboard-shell__content">{children}</div>
    </div>
  );
}

export default DashboardShell;
