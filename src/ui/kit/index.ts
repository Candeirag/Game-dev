/**
 * O kit do visual "muro dos boxes": os componentes base de todas as telas. Tela nova só usa o
 * que sai daqui e os tokens de `src/ui/tokens.css`; o catálogo (`#/dev/catalogo`, no servidor
 * de desenvolvimento) mostra tudo numa tela.
 */
export { cx, type Tone } from './cx';
export { Button, advanceButtonClass, type ButtonVariant } from './Button';
export { Card, Panel, type CardProps } from './Card';
export { Chip, Pill, Tag } from './Chip';
export { ProgressBar, meterTone } from './ProgressBar';
export { Gauge, Meter, RatingBar } from './meters';
export { TyreBadge, TYRE_LETTERS } from './TyreBadge';
export { Delta } from './Delta';
export { Sparkline } from './Sparkline';
export { LowerThird } from './LowerThird';
export { PositionBadge, TableWrap, TeamSwatch, Tower, td, th, type TowerRow } from './Table';
export { Check, ChoiceCard, EmptyState, PageHeader, Stat, Tabs } from './layout';
export { Segmented, Slider, Switch } from './controls';
export { Ring } from './Ring';
export { NumberPlate, ResultChips, WeatherBadge, WeatherTag, YouMark, type RecentResult } from './bits';
