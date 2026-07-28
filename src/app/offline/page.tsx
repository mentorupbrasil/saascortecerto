import { CortzoLockup } from "@/components/brand/brand-mark";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function OfflinePage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-6 text-center safe-top safe-bottom">
      <CortzoLockup size={40} className="mb-6 justify-center" productClassName="text-xl" />
      <h1 className="text-2xl font-bold text-foreground">Você está sem conexão</h1>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        Os dados da barbearia voltam assim que a internet reconectar. Nada sensível
        fica guardado offline.
      </p>
      <Link href="/dashboard" className="mt-6 block w-full max-w-xs">
        <Button className="w-full min-h-[44px]" size="lg">
          Tentar novamente
        </Button>
      </Link>
    </div>
  );
}
