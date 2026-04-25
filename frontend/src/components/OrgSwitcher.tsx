import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Building2, Check, ChevronDown, Plus, UserPlus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useOrgStore } from "../stores/orgStore";
import { cn } from "../utils/cn";

export function OrgSwitcher({ collapsed }: { collapsed?: boolean }) {
  const { currentOrg, myOrgs, setCurrentOrg } = useOrgStore();
  const navigate = useNavigate();

  if (!currentOrg && myOrgs.length === 0) {
    return (
      <button
        onClick={() => navigate("/orgs/create-or-join")}
        className="flex w-full items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-indigo-400 hover:text-indigo-600"
      >
        <Plus className="h-4 w-4" />
        {!collapsed && <span>Créer/Rejoindre une asso</span>}
      </button>
    );
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className={cn(
            "flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm hover:border-indigo-300 hover:bg-indigo-50/50",
            collapsed && "justify-center px-2",
          )}
          title={collapsed ? currentOrg?.name : undefined}
        >
          <div className="flex min-w-0 items-center gap-2">
            <Building2 className="h-4 w-4 shrink-0 text-indigo-600" />
            {!collapsed && (
              <span className="truncate font-medium text-gray-800">
                {currentOrg?.name ?? "Aucune asso"}
              </span>
            )}
          </div>
          {!collapsed && <ChevronDown className="h-4 w-4 shrink-0 text-gray-400" />}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={4}
          className="z-50 min-w-[220px] rounded-lg border border-gray-200 bg-white p-1 shadow-lg"
        >
          <div className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
            Mes associations
          </div>
          {myOrgs.map((org) => (
            <DropdownMenu.Item
              key={org.id}
              onSelect={() => setCurrentOrg(org)}
              className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-sm outline-none hover:bg-gray-100"
            >
              <span className="flex items-center gap-2">
                <Building2 className="h-3.5 w-3.5 text-gray-400" />
                <span className="truncate">{org.name}</span>
              </span>
              {currentOrg?.id === org.id && (
                <Check className="h-3.5 w-3.5 text-indigo-600" />
              )}
            </DropdownMenu.Item>
          ))}
          <DropdownMenu.Separator className="my-1 h-px bg-gray-100" />
          <DropdownMenu.Item
            onSelect={() => navigate("/orgs/create")}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-gray-100"
          >
            <Plus className="h-3.5 w-3.5 text-gray-400" />
            Créer une asso
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => navigate("/orgs/join")}
            className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm outline-none hover:bg-gray-100"
          >
            <UserPlus className="h-3.5 w-3.5 text-gray-400" />
            Rejoindre une asso
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
