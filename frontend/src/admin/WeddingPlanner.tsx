import { useRef, useState, type KeyboardEvent } from "react";

const plannerTabs = [
  "Overview",
  "Budget",
  "Expenses",
  "Installments",
  "Vendors",
  "Checklist",
] as const;

type PlannerTab = (typeof plannerTabs)[number];

export function WeddingPlanner() {
  const [activeTab, setActiveTab] = useState<PlannerTab>("Overview");
  const tabButtons = useRef<(HTMLButtonElement | null)[]>([]);

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number) {
    let nextIndex: number;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = (index + 1) % plannerTabs.length;
        break;
      case "ArrowLeft":
        nextIndex = (index - 1 + plannerTabs.length) % plannerTabs.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = plannerTabs.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    setActiveTab(plannerTabs[nextIndex]);
    tabButtons.current[nextIndex]?.focus();
  }

  return (
    <section className="admin-guests admin-content" aria-labelledby="planner-title">
      <div className="admin-section-heading">
        <div>
          <h2 id="planner-title">Wedding Planner</h2>
          <p>Plan and manage your wedding budget, payments, vendors, installments, and checklist.</p>
        </div>
      </div>

      <div className="admin-content-tabs" role="tablist" aria-label="Wedding planner sections">
        {plannerTabs.map((tab, index) => (
          <button
            key={tab}
            ref={(element) => { tabButtons.current[index] = element; }}
            id={`planner-tab-${tab.toLowerCase()}`}
            type="button"
            role="tab"
            className={activeTab === tab ? "is-active" : ""}
            aria-selected={activeTab === tab}
            aria-controls={`planner-panel-${tab.toLowerCase()}`}
            tabIndex={activeTab === tab ? 0 : -1}
            onClick={() => setActiveTab(tab)}
            onKeyDown={(event) => handleTabKeyDown(event, index)}
          >
            {tab}
          </button>
        ))}
      </div>

      {plannerTabs.map((tab) => (
        <div
          key={tab}
          id={`planner-panel-${tab.toLowerCase()}`}
          role="tabpanel"
          aria-labelledby={`planner-tab-${tab.toLowerCase()}`}
          hidden={activeTab !== tab}
          tabIndex={0}
        >
          <div className="admin-content-card">
            <h3>{tab}</h3>
          </div>
        </div>
      ))}
    </section>
  );
}
