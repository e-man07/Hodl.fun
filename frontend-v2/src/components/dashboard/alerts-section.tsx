'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Bell, Plus, Trash2, TrendingUp, TrendingDown, Award, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAlerts } from '@/queries/alerts';
import { useCreateAlert, useDeleteAlert } from '@/mutations/use-alerts';
import { useAlertForm } from '@/hooks/use-alert-form';
import { formatFromWei, formatRelativeTime, getIPFSUrl, cn } from '@/lib/utils';
import type { Alert, AlertType } from '@/types';

const ALERT_TYPE_CONFIG: Record<AlertType, { label: string; icon: React.ElementType; color: string }> = {
  PRICE_ABOVE: { label: 'Price Above', icon: TrendingUp, color: 'text-success' },
  PRICE_BELOW: { label: 'Price Below', icon: TrendingDown, color: 'text-destructive' },
  GRADUATION: { label: 'Graduation', icon: Award, color: 'text-primary' },
};

export function AlertsSection() {
  const { data: alerts, isLoading } = useAlerts();
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Price Alerts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Price Alerts
          </CardTitle>
          <CardDescription>Get notified when price targets are hit</CardDescription>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
          New Alert
        </Button>
      </CardHeader>
      <CardContent>
        {!alerts || alerts.length === 0 ? (
          <div className="py-8 text-center">
            <Bell className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground mb-2">No alerts yet</p>
            <p className="text-xs text-muted-foreground mb-4">
              Create alerts to track price movements
            </p>
            <Button variant="outline" size="sm" onClick={() => setIsCreateOpen(true)}>
              Create First Alert
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => (
              <AlertItem key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </CardContent>

      <CreateAlertDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} />
    </Card>
  );
}

function AlertItem({ alert }: { alert: Alert }) {
  const deleteAlert = useDeleteAlert();
  const config = ALERT_TYPE_CONFIG[alert.alertType];
  const Icon = config.icon;
  const imageUrl = alert.token.metadata?.image ? getIPFSUrl(alert.token.metadata.image) : null;

  const handleDelete = async () => {
    try {
      await deleteAlert.mutateAsync(alert.id);
      toast.success('Alert deleted');
    } catch {
      toast.error('Failed to delete alert');
    }
  };

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
      {/* Token Icon */}
      <Link href={`/token/${alert.tokenAddress}`}>
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={alert.token.name}
            width={40}
            height={40}
            className="rounded-lg object-cover"
          />
        ) : (
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
            {alert.token.symbol.slice(0, 2)}
          </div>
        )}
      </Link>

      {/* Alert Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Link href={`/token/${alert.tokenAddress}`} className="font-medium hover:text-primary">
            {alert.token.symbol}
          </Link>
          <Badge variant="outline" className={cn('text-xs', config.color)}>
            <Icon className="h-3 w-3 mr-1" />
            {config.label}
          </Badge>
          {!alert.isActive && (
            <Badge variant="secondary" className="text-xs">
              Triggered
            </Badge>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {alert.targetPrice ? (
            <span className="font-mono">{formatFromWei(alert.targetPrice).toFixed(8)} PUSH</span>
          ) : (
            <span>When token graduates</span>
          )}
        </div>
      </div>

      {/* Timestamp */}
      <div className="text-xs text-muted-foreground hidden sm:block">
        {alert.triggeredAt
          ? `Triggered ${formatRelativeTime(alert.triggeredAt)}`
          : `Created ${formatRelativeTime(alert.createdAt)}`}
      </div>

      {/* Delete Button */}
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-muted-foreground hover:text-destructive"
        onClick={handleDelete}
        disabled={deleteAlert.isPending}
      >
        {deleteAlert.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Trash2 className="h-4 w-4" />
        )}
      </Button>
    </div>
  );
}

function CreateAlertDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  // Lifted state to reducer hook (patterns-lift-state rule)
  const {
    tokenAddress,
    alertType,
    targetPrice,
    setTokenAddress,
    setAlertType,
    setTargetPrice,
    reset,
  } = useAlertForm();
  const createAlert = useCreateAlert();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!tokenAddress) {
      toast.error('Token address is required');
      return;
    }

    if (alertType !== 'GRADUATION' && !targetPrice) {
      toast.error('Target price is required');
      return;
    }

    try {
      await createAlert.mutateAsync({
        tokenAddress,
        alertType,
        targetPrice:
          alertType !== 'GRADUATION'
            ? BigInt(Math.floor(parseFloat(targetPrice) * 1e18)).toString()
            : undefined,
      });
      toast.success('Alert created');
      onOpenChange(false);
      reset();
    } catch {
      toast.error('Failed to create alert');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create Price Alert</DialogTitle>
          <DialogDescription>
            Get notified when a token reaches your target price
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Token Address</label>
            <Input
              placeholder="0x..."
              value={tokenAddress}
              onChange={(e) => setTokenAddress(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Alert Type</label>
            <Select value={alertType} onValueChange={(v) => setAlertType(v as AlertType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PRICE_ABOVE">Price Above</SelectItem>
                <SelectItem value="PRICE_BELOW">Price Below</SelectItem>
                <SelectItem value="GRADUATION">Graduation</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {alertType !== 'GRADUATION' && (
            <div className="space-y-2">
              <label className="text-sm font-medium">Target Price (PUSH)</label>
              <Input
                type="number"
                placeholder="0.00000001"
                step="any"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
              />
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={createAlert.isPending}>
              {createAlert.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Create Alert
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
