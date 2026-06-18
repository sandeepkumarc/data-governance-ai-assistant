import { GovernancePrinciplesPanel } from "../components/GovernancePrinciplesPanel";

export function GovernancePrinciplesPage({ embedded = false }: { embedded?: boolean }) {
  return <GovernancePrinciplesPanel embedded={embedded} />;
}
