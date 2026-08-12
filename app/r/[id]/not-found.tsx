import Link from "next/link";
import { FileQuestion } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Panel } from "@/components/ui/panel";
import { EmptyState } from "@/components/ui/states";

export default function ReportNotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-16">
      <Panel>
        <EmptyState
          icon={FileQuestion}
          title="That report doesn't exist"
          description="It may have been deleted, or the server was restarted while running without a database — in that mode reports are held in memory only."
          action={
            <Button asChild variant="primary">
              <Link href="/">Analyse a repository</Link>
            </Button>
          }
        />
      </Panel>
    </div>
  );
}
