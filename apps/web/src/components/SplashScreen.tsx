import { CipheraMascot } from "./CipheraMascot.tsx";

type SplashScreenProps = {
  exiting?: boolean;
};

export function SplashScreen({ exiting = false }: SplashScreenProps) {
  return (
    <main className={`splash-screen ${exiting ? "splash-screen--exit" : ""}`}>
      <div className="splash-content">
        <CipheraMascot size={108} animated />
        <h1 className="splash-title">Ciphera</h1>
        <p className="splash-tagline">Private chats, encrypted.</p>
        <div className="splash-loader" aria-hidden>
          <span />
          <span />
          <span />
        </div>
      </div>
    </main>
  );
}