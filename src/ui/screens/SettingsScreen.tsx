/**
 * Ajustes: acessibilidade, vibração e som. Tudo fica guardado no aparelho (fora dos saves) e
 * vale na hora, para todas as carreiras. Nada aqui muda o jogo.
 */
import { ArrowLeft, Play } from 'lucide-react';
import { Link } from 'react-router-dom';
import { hapticsAvailable } from '@/platform/haptics';
import { Button, Card, Chip, Delta, PageHeader, Segmented, Slider, Switch, TyreBadge } from '@/ui/kit';
import { playSound } from '../feedback/audio';
import { feedback } from '../feedback/feedback';
import { TEXT_SIZES, TEXT_SIZE_LABELS, systemPrefersReducedMotion, updateSettings } from '../settings/settings';
import { useSettings } from '../settings/useSettings';

const TEXT_OPTIONS = TEXT_SIZES.map((value) => ({ value, label: TEXT_SIZE_LABELS[value] }));

export function SettingsPanel() {
  const settings = useSettings();
  const canVibrate = hapticsAvailable();
  const systemMotion = systemPrefersReducedMotion();
  return (
    <div className="grid items-start gap-4 md:grid-cols-2">
      <Card title="Leitura" bodyClassName="space-y-4 p-4">
        <div>
          <div className="mb-2 text-sm font-semibold text-ink-100">Tamanho do texto</div>
          <Segmented label="Tamanho do texto" value={settings.textSize} options={TEXT_OPTIONS} onChange={(textSize) => updateSettings({ textSize })} />
          <p className="mt-2 text-xs leading-snug text-ink-400">Soma-se ao tamanho de texto escolhido nos ajustes do aparelho.</p>
        </div>
        <div className="border-t border-ink-700 pt-2">
          <Switch
            label="Modo para daltônicos"
            hint="Troca o verde por azul e usa cores de pneu que não dependem de vermelho contra verde. Letras, setas e ícones continuam iguais."
            checked={settings.colorBlind}
            onChange={(colorBlind) => updateSettings({ colorBlind })}
          />
          <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Amostra das cores">
            <Chip tone="good">Na meta</Chip>
            <Chip tone="attention">Abaixo da meta</Chip>
            <Delta value={2} signless suffix=" posições" className="text-xs" />
            <Delta value={-1} signless suffix=" posição" className="text-xs" />
            <span className="flex items-center gap-1">
              <TyreBadge compound="soft" />
              <TyreBadge compound="medium" />
              <TyreBadge compound="hard" />
              <TyreBadge compound="intermediate" />
              <TyreBadge compound="wet" />
            </span>
          </div>
        </div>
      </Card>

      <Card title="Movimento, vibração e som" bodyClassName="space-y-2 p-4">
        <Switch
          label="Menos movimento"
          hint={
            systemMotion
              ? 'O aparelho já pede menos movimento: o jogo segue esse ajuste, com este interruptor ligado ou não.'
              : 'Nada desliza nem dá zoom: as telas só esmaecem e a câmera da corrida fica parada.'
          }
          checked={settings.reduceMotion || systemMotion}
          disabled={systemMotion}
          onChange={(reduceMotion) => updateSettings({ reduceMotion })}
        />
        <div className="border-t border-ink-700 pt-2">
          <Switch
            label="Vibração"
            hint={
              canVibrate
                ? 'Só em momentos importantes: vitória, toque, punição, decisão arriscada. Nunca a cada toque.'
                : 'Só existe no aplicativo instalado; no navegador o aparelho não vibra.'
            }
            checked={canVibrate && settings.haptics}
            disabled={!canVibrate}
            onChange={(haptics) => {
              updateSettings({ haptics });
              if (haptics) feedback('paceChange');
            }}
          />
        </div>
        <div className="space-y-2 border-t border-ink-700 pt-4">
          <Slider label="Efeitos" value={settings.effectsVolume} onChange={(effectsVolume) => updateSettings({ effectsVolume })} />
          <Slider label="Música" value={settings.musicVolume} onChange={(musicVolume) => updateSettings({ musicVolume })} />
          <div className="flex flex-wrap items-center gap-4">
            <Button onClick={() => playSound('podium')} disabled={settings.effectsVolume === 0}>
              <Play size={16} aria-hidden />
              Testar efeitos
            </Button>
            <p className="min-w-0 flex-1 text-xs leading-snug text-ink-400">
              O jogo ainda não tem trilha sonora; o volume da música já fica guardado para quando ela chegar.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

/** Ajustes dentro de uma carreira (na moldura do jogo). */
export function SettingsScreen() {
  return (
    <div>
      <PageHeader title="Ajustes" eyebrow="Guardados neste aparelho; valem para todas as carreiras" />
      <SettingsPanel />
    </div>
  );
}

/** Ajustes abertos pelo menu inicial, sem carreira carregada. */
export function MenuSettingsScreen() {
  return (
    <main className="mx-auto min-h-dvh w-full max-w-[1100px] pb-[calc(1.5rem+var(--safe-bottom))] pl-[calc(1rem+var(--safe-left))] pr-[calc(1rem+var(--safe-right))] pt-[calc(1rem+var(--safe-top))]">
      <Link to="/" className="mb-2 inline-flex min-h-11 items-center gap-2 pr-4 text-sm font-semibold text-ink-200 hover:text-ink-100">
        <ArrowLeft size={18} aria-hidden />
        Menu principal
      </Link>
      <SettingsScreen />
    </main>
  );
}
