import WhatsAppConnect from "@/components/admin/WhatsAppConnect";

export const metadata = { title: "WhatsApp | Admin" };

export default function WhatsAppPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">WhatsApp</h1>
        <p className="text-muted-foreground">
          Connect the WhatsApp Business number booking confirmations send
          from.
        </p>
      </div>

      <WhatsAppConnect />
    </div>
  );
}
