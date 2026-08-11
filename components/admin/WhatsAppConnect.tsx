"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Send,
  Unlink,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Keep in step with WHATSAPP_API_VERSION (server-side env, lib/whatsapp/client.ts)
const META_API_VERSION = "v21.0";

// If the popup never resolves (user abandons it, or it never opens at
// all — e.g. blocked by the browser) the FB.login callback simply never
// fires, leaving the button stuck on its loading state forever.
const CONNECT_TIMEOUT_MS = 2 * 60 * 1000;

declare global {
  interface Window {
    FB?: {
      init: (params: Record<string, unknown>) => void;
      login: (
        callback: (response: { authResponse?: { code?: string } }) => void,
        params: Record<string, unknown>
      ) => void;
    };
    fbAsyncInit?: () => void;
  }
}

type SyncState = {
  windowRemainingMs: number;
  contactsRequestedAt: string | null;
  contactsError: string | null;
  historyRequestedAt: string | null;
  historyError: string | null;
  historyReceivedAt: string | null;
};

type FailureRow = {
  to_e164: string;
  status: string;
  skip_reason: string | null;
  error_code: number | null;
  error_message: string | null;
  created_at: string;
};

type TemplateInfo = {
  name: string | null;
  language: string;
  variables: string[];
};

type Status =
  | { state: "loading" }
  | {
      state: "disconnected";
      envFallbackConfigured: boolean;
      template: TemplateInfo;
      recentFailures: FailureRow[];
    }
  | {
      state: "connected";
      working: boolean;
      displayPhoneNumber: string | null;
      verifiedName: string | null;
      qualityRating: string | null;
      isOnBizApp: boolean | null;
      platformType: string | null;
      connectedAt: string;
      error?: string;
      sync: SyncState;
      template: TemplateInfo;
      recentFailures: FailureRow[];
    };

function formatRemaining(ms: number): string {
  if (ms <= 0) return "expired";
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return hours > 0 ? `${hours}h ${minutes}m left` : `${minutes}m left`;
}

export default function WhatsAppConnect() {
  const [status, setStatus] = useState<Status>({ state: "loading" });
  const [sdkReady, setSdkReady] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [testPhone, setTestPhone] = useState("");
  const [testing, setTesting] = useState(false);

  // Meta posts the WABA ID / Phone Number ID via a window "message" event
  // partway through the popup flow, separately from the `code` the
  // FB.login callback resolves with once the popup closes — a ref (not
  // state) so the login callback's closure always sees the latest value.
  const signupData = useRef<{ wabaId?: string; phoneNumberId?: string }>({});
  const connectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Don't let a stuck popup's timeout fire (or the FB.login callback
  // resolve) after the component's gone.
  useEffect(() => {
    return () => {
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
    };
  }, []);

  const refreshStatus = useCallback(async () => {
    setStatus({ state: "loading" });
    try {
      const res = await fetch("/api/admin/whatsapp/status");
      const data = await res.json();
      if (!data.connected) {
        setStatus({
          state: "disconnected",
          envFallbackConfigured: Boolean(data.envFallbackConfigured),
          template: data.template,
          recentFailures: data.recentFailures ?? [],
        });
        return;
      }
      setStatus({
        state: "connected",
        working: Boolean(data.working),
        displayPhoneNumber: data.displayPhoneNumber ?? null,
        verifiedName: data.verifiedName ?? null,
        qualityRating: data.qualityRating ?? null,
        isOnBizApp: data.isOnBizApp ?? null,
        platformType: data.platformType ?? null,
        connectedAt: data.connectedAt,
        error: data.error,
        sync: data.sync,
        template: data.template,
        recentFailures: data.recentFailures ?? [],
      });
    } catch {
      setStatus({
        state: "disconnected",
        envFallbackConfigured: false,
        template: { name: null, language: "en", variables: [] },
        recentFailures: [],
      });
    }
  }, []);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.origin !== "https://www.facebook.com") return;
      let data: { type?: string; event?: string; data?: Record<string, string> };
      try {
        data = JSON.parse(event.data);
      } catch {
        return; // Facebook posts other non-JSON message shapes on the same channel.
      }
      // "FINISH" is the plain new-number flow;
      // "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING" is the coexistence flow
      // (number already active in the WhatsApp Business mobile app) —
      // that one only carries waba_id, not a phone_number_id, since the
      // number isn't newly selected here.
      if (
        data.type === "WA_EMBEDDED_SIGNUP" &&
        (data.event === "FINISH" || data.event === "FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING")
      ) {
        signupData.current = {
          wabaId: data.data?.waba_id,
          phoneNumberId: data.data?.phone_number_id,
        };
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  function handleConnect() {
    const appId = process.env.NEXT_PUBLIC_META_APP_ID;
    const configId = process.env.NEXT_PUBLIC_META_CONFIG_ID;
    if (!sdkReady || !window.FB || !appId || !configId) {
      toast.error(
        "WhatsApp signup isn't configured (NEXT_PUBLIC_META_APP_ID / NEXT_PUBLIC_META_CONFIG_ID)."
      );
      return;
    }

    signupData.current = {};
    setConnecting(true);

    // Whichever of these two settles first (timeout vs. the popup
    // actually closing) wins; the other is a no-op.
    let settled = false;

    connectTimeoutRef.current = setTimeout(() => {
      if (settled) return;
      settled = true;
      setConnecting(false);
      toast.error("WhatsApp connection timed out after 2 minutes — please try again.");
    }, CONNECT_TIMEOUT_MS);

    // The FB SDK's own internal handling of this callback rejects an
    // `async` function outright (throws "Expression is of type
    // asyncfunction, not function") — it must be a plain function, with
    // any async work run separately inside it.
    function onLoginResponse(response: { authResponse?: { code?: string } }) {
      if (settled) return;
      settled = true;
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);

      const code = response.authResponse?.code;
      // phoneNumberId is only present for the plain new-number flow —
      // the coexistence flow only returns a waba_id, so the connect API
      // route looks the phone number up itself when it's missing here.
      const { wabaId, phoneNumberId } = signupData.current;

      if (!code || !wabaId) {
        setConnecting(false);
        toast.error("Signup was cancelled or didn't finish.");
        return;
      }

      (async () => {
        try {
          const res = await fetch("/api/admin/whatsapp/connect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ code, wabaId, phoneNumberId }),
          });
          const data = await res.json();
          if (!res.ok && res.status !== 207) {
            throw new Error(data.error ?? "Failed to connect.");
          }

          if (data.onboarding?.ok) {
            toast.success("WhatsApp connected and syncing.");
          } else {
            // 207: credentials saved but a sync step failed. Say so
            // plainly — the 24h window is still running and the retry
            // button is the fix.
            toast.warning(
              "WhatsApp connected, but the chat history sync didn't start. Use “Retry sync” below."
            );
          }
          await refreshStatus();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Failed to connect.");
        } finally {
          setConnecting(false);
        }
      })();
    }

    try {
      window.FB.login(onLoginResponse, {
        config_id: configId,
        response_type: "code",
        override_default_response_type: true,
        // whatsapp_business_app_onboarding = "coexistence": this
        // business's number is already active in the WhatsApp Business
        // mobile app, so this triggers the wizard that links it to the
        // Cloud API instead of treating it as a brand-new number.
        // Requires the Meta app to have completed Tech Provider
        // onboarding + App Review.
        extras: {
          setup: {},
          featureType: "whatsapp_business_app_onboarding",
          sessionInfoVersion: "3",
        },
      });
    } catch (err) {
      settled = true;
      if (connectTimeoutRef.current) clearTimeout(connectTimeoutRef.current);
      setConnecting(false);
      toast.error(err instanceof Error ? err.message : "Failed to open the WhatsApp signup window.");
    }
  }

  async function handleRetrySync() {
    setSyncing(true);
    try {
      const res = await fetch("/api/admin/whatsapp/sync", { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        toast.success("Sync requested.");
      } else {
        const failed = (data.steps ?? []).find(
          (s: { ok: boolean; error?: string }) => !s.ok
        );
        toast.error(failed?.error ?? "Sync could not be started.");
      }
      await refreshStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleDisconnect() {
    setDisconnecting(true);
    try {
      const res = await fetch("/api/admin/whatsapp/disconnect", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to disconnect.");
      toast.success("WhatsApp disconnected.");
      if (data.coexistenceNotice) toast.info(data.coexistenceNotice, { autoClose: false });
      setConfirmOpen(false);
      await refreshStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to disconnect.");
    } finally {
      setDisconnecting(false);
    }
  }

  async function handleTest() {
    if (!testPhone.trim()) {
      toast.error("Enter a phone number first.");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/admin/whatsapp/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: testPhone.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to send test message.");
      toast.success(`Test message sent to ${data.to}.`);
      await refreshStatus();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send test message.");
    } finally {
      setTesting(false);
    }
  }

  const isConnected = status.state === "connected";
  const canSend =
    isConnected || (status.state === "disconnected" && status.envFallbackConfigured);

  return (
    <>
      <Script
        src="https://connect.facebook.net/en_US/sdk.js"
        strategy="afterInteractive"
        onReady={() => {
          window.fbAsyncInit = () => {
            window.FB?.init({
              appId: process.env.NEXT_PUBLIC_META_APP_ID,
              cookie: true,
              xfbml: false,
              version: META_API_VERSION,
            });
            setSdkReady(true);
          };
          // If the script finished loading before this handler ran, the
          // SDK calls fbAsyncInit itself on the *next* load — call it now
          // so we don't wait on a load event that already fired.
          if (window.FB) window.fbAsyncInit();
        }}
      />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>WhatsApp Connection</CardTitle>
            <CardDescription>
              The WhatsApp Business number booking confirmations are sent from.
              Connecting an existing WhatsApp Business app number keeps it working
              on the phone (coexistence) while this site sends confirmations.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {status.state === "loading" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Checking connection…
              </div>
            )}

            {status.state === "disconnected" && (
              <div className="space-y-2">
                <Badge variant="outline" className="gap-1 text-muted-foreground">
                  <XCircle className="h-3.5 w-3.5" /> Not connected
                </Badge>
                {status.envFallbackConfigured && (
                  <p className="text-sm text-muted-foreground">
                    Falling back to the <code>WHATSAPP_TOKEN</code> env credentials.
                    That works for an API-only number, but coexistence has to be set
                    up through the button below.
                  </p>
                )}
              </div>
            )}

            {isConnected && (
              <div className="space-y-2">
                {status.working ? (
                  <Badge variant="success" className="gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Connected &amp; working
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3.5 w-3.5" /> Connected, but not working
                  </Badge>
                )}
                {status.displayPhoneNumber && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Number:</span>{" "}
                    {status.displayPhoneNumber}
                    {status.verifiedName ? ` (${status.verifiedName})` : ""}
                  </p>
                )}
                <p className="text-sm">
                  <span className="text-muted-foreground">Coexistence:</span>{" "}
                  {status.isOnBizApp === true ? (
                    <span className="text-green-700">
                      active — still usable in the WhatsApp Business app
                      {status.platformType ? ` (${status.platformType})` : ""}
                    </span>
                  ) : (
                    <span className="text-amber-700">
                      not active — this number is API-only, so the phone app will not
                      work alongside it
                    </span>
                  )}
                </p>
                {status.qualityRating && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Quality rating:</span>{" "}
                    {status.qualityRating}
                  </p>
                )}
                <p className="text-sm text-muted-foreground">
                  Connected {new Date(status.connectedAt).toLocaleString()}
                </p>
                {status.error && <p className="text-sm text-destructive">{status.error}</p>}
              </div>
            )}
          </CardContent>
          <CardFooter className="gap-2">
            {!isConnected ? (
              <Button onClick={handleConnect} disabled={connecting || !sdkReady}>
                {connecting && <Loader2 className="h-4 w-4 animate-spin" />}
                Connect WhatsApp
              </Button>
            ) : (
              <>
                <Button variant="outline" onClick={handleConnect} disabled={connecting || !sdkReady}>
                  {connecting && <Loader2 className="h-4 w-4 animate-spin" />}
                  Reconnect
                </Button>
                <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
                  <Unlink className="h-4 w-4" /> Disconnect
                </Button>
              </>
            )}
          </CardFooter>
        </Card>

        {isConnected && status.isOnBizApp === true && (
          <Card>
            <CardHeader>
              <CardTitle>Chat history sync</CardTitle>
              <CardDescription>
                Meta allows one attempt at each sync, and only within 24 hours of
                connecting. After that the number has to be disconnected and
                connected again from scratch.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">Sync window:</span>{" "}
                {status.sync.windowRemainingMs > 0 ? (
                  formatRemaining(status.sync.windowRemainingMs)
                ) : (
                  <span className="text-amber-700">expired</span>
                )}
              </p>
              <p>
                <span className="text-muted-foreground">Contacts:</span>{" "}
                {status.sync.contactsRequestedAt
                  ? `requested ${new Date(status.sync.contactsRequestedAt).toLocaleString()}`
                  : "not requested"}
                {status.sync.contactsError && (
                  <span className="text-destructive"> — {status.sync.contactsError}</span>
                )}
              </p>
              <p>
                <span className="text-muted-foreground">History:</span>{" "}
                {status.sync.historyReceivedAt
                  ? `received ${new Date(status.sync.historyReceivedAt).toLocaleString()}`
                  : status.sync.historyRequestedAt
                    ? `requested ${new Date(status.sync.historyRequestedAt).toLocaleString()}`
                    : "not requested"}
                {status.sync.historyError && (
                  <span className="text-amber-700"> — {status.sync.historyError}</span>
                )}
              </p>
            </CardContent>
            <CardFooter>
              <Button
                variant="outline"
                onClick={handleRetrySync}
                disabled={syncing || status.sync.windowRemainingMs === 0}
              >
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Retry sync
              </Button>
            </CardFooter>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Message template</CardTitle>
            <CardDescription>
              Confirmations must go out as a Meta-approved template. The parameter
              list below has to match the <code>{"{{1}}"}</code>… placeholders in
              the approved template, in order, or every send fails with error
              132000.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {status.state !== "loading" && (
              <>
                <p>
                  <span className="text-muted-foreground">Template:</span>{" "}
                  {status.template.name ?? (
                    <span className="text-destructive">
                      not set — WHATSAPP_TEMPLATE_NAME is missing
                    </span>
                  )}{" "}
                  <span className="text-muted-foreground">({status.template.language})</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Parameters:</span>{" "}
                  {status.template.variables.length > 0
                    ? status.template.variables
                        .map((v, i) => `{{${i + 1}}} = ${v}`)
                        .join(", ")
                    : "none"}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Send a test message</CardTitle>
            <CardDescription>
              Sends the real template with real parameters to your own number, so a
              template or language mismatch shows up here rather than on a
              customer&apos;s booking.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-1.5">
                <Label htmlFor="test-phone">Your WhatsApp number</Label>
                <Input
                  id="test-phone"
                  placeholder="e.g. 0501234567 or +9715…"
                  value={testPhone}
                  onChange={(e) => setTestPhone(e.target.value)}
                />
              </div>
              <Button onClick={handleTest} disabled={testing || !canSend}>
                {testing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send test message
              </Button>
            </div>
            {!canSend && (
              <p className="mt-2 text-sm text-muted-foreground">
                Connect a number above before sending a test message.
              </p>
            )}
          </CardContent>
        </Card>

        {status.state !== "loading" && status.recentFailures.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                Recent WhatsApp failures
              </CardTitle>
              <CardDescription>
                Confirmations that never reached the customer. Skipped means the app
                declined to send (no opt-in, opted out, or an unusable number);
                failed means Meta rejected it.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {status.recentFailures.map((row, i) => (
                <div key={i} className="border-b pb-2 last:border-0 last:pb-0">
                  <p className="font-medium">
                    {row.to_e164}{" "}
                    <Badge variant="outline" className="ml-1">
                      {row.skip_reason ?? row.status}
                    </Badge>
                  </p>
                  <p className="text-muted-foreground">
                    {new Date(row.created_at).toLocaleString()}
                    {row.error_code ? ` — Meta error ${row.error_code}` : ""}
                    {row.error_message ? `: ${row.error_message}` : ""}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Disconnect WhatsApp?</DialogTitle>
            <DialogDescription>
              Booking confirmations stop sending over WhatsApp until a number is
              connected again. For a coexistence number, the link on Meta&apos;s side
              also has to be removed from the WhatsApp Business app itself.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDisconnect} disabled={disconnecting}>
              {disconnecting && <Loader2 className="h-4 w-4 animate-spin" />}
              Disconnect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
