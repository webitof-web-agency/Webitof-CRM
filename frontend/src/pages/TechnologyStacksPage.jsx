import {
  BrainCircuit,
  BriefcaseBusiness,
  Database,
  Gauge,
  Fingerprint,
  Layers3,
  Monitor,
  Network,
  PanelsTopLeft,
  PenTool,
  Server,
  Settings2,
  ShieldCheck,
  ShieldAlert,
  ShoppingCart,
  Smartphone,
  TestTube2
} from 'lucide-react';
import { TECHNOLOGY_STACK_GROUPS } from '../config/technologyStacks';
import { DEFAULT_TECHNOLOGY_ICON, TECHNOLOGY_ICONS } from '../config/technologyIcons';

const GROUP_ICONS = {
  monitor: Monitor,
  settings: Settings2,
  layers: Layers3,
  database: Database,
  smartphone: Smartphone,
  panels: PanelsTopLeft,
  cart: ShoppingCart,
  server: Server,
  network: Network,
  pen: PenTool,
  gauge: Gauge,
  briefcase: BriefcaseBusiness,
  testing: TestTube2,
  ai: BrainCircuit,
  security: ShieldCheck,
  'app-security': ShieldAlert,
  'identity-security': Fingerprint
};

export function TechnologyStacksPage() {
  return (
    <div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {TECHNOLOGY_STACK_GROUPS.map((group) => {
          const GroupIcon = GROUP_ICONS[group.icon] || Layers3;
          return (
            <article
              key={group.id}
              className="flex min-h-[250px] flex-col overflow-hidden rounded-[18px] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-card)] backdrop-blur-xl transition-colors hover:border-[var(--primary)]"
            >
              <div className="flex items-center gap-3">
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ backgroundColor: `${group.color}18`, color: group.color }}
                >
                  <GroupIcon size={20} strokeWidth={2.25} />
                </span>
                <h2 className="text-base font-extrabold tracking-tight text-[var(--text-main)] sm:text-lg">
                  {group.title}
                </h2>
              </div>

              <p className="mt-3 text-[13px] font-medium leading-5 text-[var(--text-muted)]">
                {group.description}
              </p>

              <div className="mt-auto flex flex-wrap gap-1.5 pt-5">
                {group.technologies.map((technology) => {
                  const technologyIcon = TECHNOLOGY_ICONS[technology] || DEFAULT_TECHNOLOGY_ICON;
                  const TechnologyIcon = technologyIcon.Icon;
                  return (
                    <span
                      key={`${group.id}-${technology}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1.5 text-[11px] font-semibold leading-none text-[var(--text-main)]"
                    >
                      <TechnologyIcon size={13} strokeWidth={2.2} style={{ color: technologyIcon.color }} />
                      {technology}
                    </span>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
