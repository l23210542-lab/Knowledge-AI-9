import { AppLayout } from "@/components/layout/AppLayout";
import { SearchHero } from "@/components/dashboard/SearchHero";
import { StatsCards } from "@/components/dashboard/StatsCards";
import { RecentQueries } from "@/components/dashboard/RecentQueries";
import { PopularDocuments } from "@/components/dashboard/PopularDocuments";

const Index = () => {
  return (
    <AppLayout>
      <div className="space-y-8 animate-fade-in">
        <SearchHero />
        
        <div className="grid gap-6 lg:grid-cols-2">
        </div>
      </div>
    </AppLayout>
  );
};

export default Index;
