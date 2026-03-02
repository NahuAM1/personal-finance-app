'use client';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Receipt, ShoppingCart, Users } from 'lucide-react';
import { AuthGuard } from '@/components/auth-guard';
import { AccessControl } from '@/components/access-control';
import { USER_ROLES } from '@/types/database';
import { ReceiptScanner } from '@/components/smartpocket/receipt-scanner';
import { ReceiptList } from '@/components/smartpocket/receipt-list';
import { ReceiptDetail } from '@/components/smartpocket/receipt-detail';
import { ShoppingDashboard } from '@/components/smartpocket/shopping-dashboard';
import { ShoppingRecommendations } from '@/components/smartpocket/shopping-recommendations';
import { SplitGroups } from '@/components/smartpocket/split-groups';
import { SplitGroupDetail } from '@/components/smartpocket/split-group-detail';
import { useTickets } from '@/hooks/use-tickets';
import { useSplitGroups } from '@/hooks/use-split-groups';
import { useState } from 'react';
import { Loader } from '@/components/loader';
import type { Ticket } from '@/types/database';

function SmartPocketContent() {
  const {
    tickets,
    loading: ticketsLoading,
    selectedTicket,
    selectTicket,
    clearSelectedTicket,
    refetchTickets,
    deleteTicket,
  } = useTickets();

  const {
    groups,
    loading: groupsLoading,
    selectedGroup,
    selectGroup,
    clearSelectedGroup,
    refetchGroups,
  } = useSplitGroups();

  const [activeTab, setActiveTab] = useState('tickets');

  if (ticketsLoading || groupsLoading) {
    return <Loader />;
  }

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
      <div className="flex items-center justify-center">
        <TabsList className="w-full max-w-lg justify-around bg-purple-100/50 dark:bg-purple-900/20">
          <TabsTrigger
            value="tickets"
            className="flex items-center gap-2 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300"
          >
            <Receipt className="h-4 w-4" />
            <span className="hidden sm:inline">Tickets</span>
          </TabsTrigger>
          <TabsTrigger
            value="shopping"
            className="flex items-center gap-2 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300"
          >
            <ShoppingCart className="h-4 w-4" />
            <span className="hidden sm:inline">Compras Inteligentes</span>
          </TabsTrigger>
          <TabsTrigger
            value="split"
            className="flex items-center gap-2 data-[state=active]:text-purple-700 dark:data-[state=active]:text-purple-300"
          >
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Dividir Gastos</span>
          </TabsTrigger>
        </TabsList>
      </div>

      <TabsContent value="tickets">
        {selectedTicket ? (
          <ReceiptDetail
            ticket={selectedTicket}
            onBack={clearSelectedTicket}
            onDelete={async (id) => {
              await deleteTicket(id);
              clearSelectedTicket();
            }}
            onUpdate={refetchTickets}
          />
        ) : (
          <div className="space-y-6">
            <ReceiptScanner onScanComplete={refetchTickets} />
            <ReceiptList
              tickets={tickets}
              onSelectTicket={(ticket: Ticket) => selectTicket(ticket)}
              onDelete={deleteTicket}
            />
          </div>
        )}
      </TabsContent>

      <TabsContent value="shopping">
        <div className="space-y-6">
          <ShoppingDashboard tickets={tickets} />
          <ShoppingRecommendations />
        </div>
      </TabsContent>

      <TabsContent value="split">
        {selectedGroup ? (
          <SplitGroupDetail
            group={selectedGroup}
            onBack={clearSelectedGroup}
            onUpdate={refetchGroups}
          />
        ) : (
          <SplitGroups
            groups={groups}
            onSelectGroup={selectGroup}
            onGroupCreated={refetchGroups}
          />
        )}
      </TabsContent>
    </Tabs>
  );
}

function SmartPocketPremiumGate() {
  return (
    <AccessControl
      allowedRoles={[USER_ROLES.PREMIUM, USER_ROLES.ADMIN]}
      fallback={
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
          <div className="w-20 h-20 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center mb-6">
            <Receipt className="h-10 w-10 text-purple-600 dark:text-purple-400" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            SmartPocket es Premium
          </h2>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mb-6">
            Accede a funcionalidades avanzadas como el scanner de tickets con IA,
            dashboard inteligente de compras y dividir gastos con amigos.
          </p>
          <a
            href="/"
            className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-full font-medium hover:opacity-90 transition-opacity"
          >
            Volver a Personal Wallet
          </a>
        </div>
      }
    >
      <SmartPocketContent />
    </AccessControl>
  );
}

export default function SmartPocketPage() {
  return (
    <AuthGuard>
      <SmartPocketPremiumGate />
    </AuthGuard>
  );
}
