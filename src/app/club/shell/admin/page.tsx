'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2, Check, X, Trash2, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';

interface Application {
  id: number;
  address: string;
  name: string | null;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  approved_at: string | null;
}

export default function ShellClubAdminPage() {
  const { data: session, status: sessionStatus } = useSession();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [editingName, setEditingName] = useState<Record<string, string>>({});

  // 신청 목록 조회
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['shell-club-applications'],
    queryFn: async () => {
      const response = await fetch('/api/club/shell/admin');
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data.applications as Application[];
    },
    enabled: sessionStatus === 'authenticated',
  });

  // 승인/거절 mutation
  const actionMutation = useMutation({
    mutationFn: async ({ address, action, name }: { address: string; action: 'approve' | 'reject'; name?: string }) => {
      const response = await fetch('/api/club/shell/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, action, name }),
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['shell-club-applications'] });
      toast({
        title: variables.action === 'approve' ? '✅ 승인되었습니다' : '❌ 거절되었습니다',
        variant: variables.action === 'approve' ? 'success' : 'destructive',
      });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  // 삭제 mutation
  const deleteMutation = useMutation({
    mutationFn: async (address: string) => {
      const response = await fetch(`/api/club/shell/admin?address=${address}`, {
        method: 'DELETE',
      });
      const data = await response.json();
      if (!data.success) throw new Error(data.error);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shell-club-applications'] });
      toast({ title: '🗑️ 삭제되었습니다' });
    },
    onError: (error: Error) => {
      toast({ title: error.message, variant: 'destructive' });
    },
  });

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="px-2 py-1 bg-amber-500/20 text-amber-400 rounded text-xs">대기중</span>;
      case 'approved':
        return <span className="px-2 py-1 bg-emerald-500/20 text-emerald-400 rounded text-xs">승인됨</span>;
      case 'rejected':
        return <span className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-xs">거절됨</span>;
      default:
        return null;
    }
  };

  // 로딩 중
  if (sessionStatus === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400" />
      </div>
    );
  }

  // 미로그인
  if (sessionStatus === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800 border-slate-700 p-8 text-center">
          <p className="text-white mb-4">로그인이 필요합니다</p>
          <Link href="/" className="text-emerald-400 hover:underline">
            홈으로 돌아가기
          </Link>
        </Card>
      </div>
    );
  }

  // 권한 없음
  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <Card className="bg-slate-800 border-slate-700 p-8 text-center">
          <p className="text-red-400 mb-4">권한이 없습니다</p>
          <p className="text-slate-400 text-sm mb-4">{session?.user?.email}</p>
          <Link href="/club/shell" className="text-emerald-400 hover:underline">
            클럽 페이지로 돌아가기
          </Link>
        </Card>
      </div>
    );
  }

  const pendingApps = data?.filter(a => a.status === 'pending') || [];
  const approvedApps = data?.filter(a => a.status === 'approved') || [];
  const rejectedApps = data?.filter(a => a.status === 'rejected') || [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <header className="border-b border-slate-700/50 backdrop-blur-sm">
        <div className="max-w-4xl mx-auto px-4 md:px-6 py-4 md:py-5">
          <Link
            href="/club/shell"
            className="inline-flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-3"
          >
            <ArrowLeft className="w-5 h-5" />
            <span>돌아가기</span>
          </Link>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img src="/SHELL.svg" alt="SHELL" className="w-10 h-10 rounded-full" />
              <div>
                <h1 className="text-xl md:text-2xl font-bold text-white">SHELL CLUB 관리</h1>
                <p className="text-sm text-slate-400">{session?.user?.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              새로고침
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 md:px-6 py-6 md:py-10">
        {/* 통계 */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card className="bg-amber-500/10 border-amber-500/30 p-4 text-center">
            <p className="text-amber-400 text-2xl font-bold">{pendingApps.length}</p>
            <p className="text-amber-400/70 text-sm">대기중</p>
          </Card>
          <Card className="bg-emerald-500/10 border-emerald-500/30 p-4 text-center">
            <p className="text-emerald-400 text-2xl font-bold">{approvedApps.length}</p>
            <p className="text-emerald-400/70 text-sm">승인됨</p>
          </Card>
          <Card className="bg-red-500/10 border-red-500/30 p-4 text-center">
            <p className="text-red-400 text-2xl font-bold">{rejectedApps.length}</p>
            <p className="text-red-400/70 text-sm">거절됨</p>
          </Card>
        </div>

        {/* 대기중 신청 */}
        <Card className="bg-slate-800/50 border-slate-700/50 overflow-hidden mb-6">
          <div className="p-3 md:p-4 border-b border-slate-700 bg-amber-500/10">
            <h2 className="text-base md:text-lg font-semibold text-amber-400">
              대기중 신청 ({pendingApps.length})
            </h2>
          </div>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : pendingApps.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              대기중인 신청이 없습니다
            </div>
          ) : (
            <div className="divide-y divide-slate-700/50">
              {pendingApps.map((app) => (
                <div key={app.id} className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <code className="text-white font-mono text-sm">{app.address}</code>
                      <p className="text-slate-400 text-xs mt-1">{formatDate(app.created_at)}</p>
                    </div>
                    {getStatusBadge(app.status)}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="홀더 이름 (예: 홀더5)"
                      value={editingName[app.address] || ''}
                      onChange={(e) => setEditingName({ ...editingName, [app.address]: e.target.value })}
                      className="flex-1 bg-slate-700 border-slate-600 text-white text-sm h-9"
                    />
                    <Button
                      size="sm"
                      onClick={() => actionMutation.mutate({
                        address: app.address,
                        action: 'approve',
                        name: editingName[app.address] || undefined,
                      })}
                      disabled={actionMutation.isPending}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white h-9"
                    >
                      <Check className="w-4 h-4 mr-1" />
                      승인
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => actionMutation.mutate({ address: app.address, action: 'reject' })}
                      disabled={actionMutation.isPending}
                      className="h-9"
                    >
                      <X className="w-4 h-4 mr-1" />
                      거절
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* 승인된 멤버 */}
        <Card className="bg-slate-800/50 border-slate-700/50 overflow-hidden mb-6">
          <div className="p-3 md:p-4 border-b border-slate-700 bg-emerald-500/10">
            <h2 className="text-base md:text-lg font-semibold text-emerald-400">
              승인된 멤버 ({approvedApps.length})
            </h2>
          </div>
          
          {approvedApps.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              승인된 멤버가 없습니다
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="text-left text-sm font-medium text-slate-400 px-3 py-3">이름</th>
                    <th className="text-left text-sm font-medium text-slate-400 px-3 py-3">주소</th>
                    <th className="text-left text-sm font-medium text-slate-400 px-3 py-3">승인일</th>
                    <th className="text-center text-sm font-medium text-slate-400 px-3 py-3">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {approvedApps.map((app) => (
                    <tr key={app.id} className="border-t border-slate-700/50">
                      <td className="px-3 py-3 text-sm text-white">{app.name || '-'}</td>
                      <td className="px-3 py-3 text-sm text-slate-300 font-mono">{formatAddress(app.address)}</td>
                      <td className="px-3 py-3 text-sm text-slate-400">
                        {app.approved_at ? formatDate(app.approved_at) : '-'}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(app.address)}
                          disabled={deleteMutation.isPending}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {/* 거절된 신청 */}
        {rejectedApps.length > 0 && (
          <Card className="bg-slate-800/50 border-slate-700/50 overflow-hidden">
            <div className="p-3 md:p-4 border-b border-slate-700 bg-red-500/10">
              <h2 className="text-base md:text-lg font-semibold text-red-400">
                거절된 신청 ({rejectedApps.length})
              </h2>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-800">
                  <tr>
                    <th className="text-left text-sm font-medium text-slate-400 px-3 py-3">주소</th>
                    <th className="text-left text-sm font-medium text-slate-400 px-3 py-3">신청일</th>
                    <th className="text-center text-sm font-medium text-slate-400 px-3 py-3">액션</th>
                  </tr>
                </thead>
                <tbody>
                  {rejectedApps.map((app) => (
                    <tr key={app.id} className="border-t border-slate-700/50">
                      <td className="px-3 py-3 text-sm text-slate-300 font-mono">{formatAddress(app.address)}</td>
                      <td className="px-3 py-3 text-sm text-slate-400">{formatDate(app.created_at)}</td>
                      <td className="px-3 py-3 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(app.address)}
                          disabled={deleteMutation.isPending}
                          className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </main>
    </div>
  );
}
