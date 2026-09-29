import { methodLabel } from '../../methods';

export default function PlanHover({ plan, children }) {
  return (
    <span className="plan-hover">
      {children}
      <span className="plan-tooltip">
        <strong>{plan.name}</strong>
        <p>{plan.brief}</p>
        <p><span>What</span> {plan.what}</p>
        <p><span>How</span> {plan.how}</p>
        <p><span>From</span> {plan.from}</p>
        <p className="tip-method">{methodLabel(plan.method)}{plan.playwrightPattern ? ` · pattern ${plan.playwrightPattern}` : ''}</p>
      </span>
    </span>
  );
}
