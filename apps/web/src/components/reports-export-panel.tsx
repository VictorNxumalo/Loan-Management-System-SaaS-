'use client';

import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiDownload } from '@/lib/api-download';

export function ReportsExportPanel() {
  const { data: session } = useSession();
  const token = session?.accessToken;

  const download = async (path: string, filename: string) => {
    if (!token) {
      return;
    }
    await apiDownload(path, token, filename);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export reports</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          disabled={!token}
          onClick={() =>
            void download('/reports/portfolio.csv', 'portfolio.csv').catch(console.error)
          }
        >
          Download portfolio CSV
        </Button>
        <Button
          variant="outline"
          disabled={!token}
          onClick={() =>
            void download('/reports/arrears.csv', 'arrears.csv').catch(console.error)
          }
        >
          Download arrears CSV
        </Button>
      </CardContent>
    </Card>
  );
}
