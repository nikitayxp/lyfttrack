import { Check, ChevronDown, CloudOff, Dumbbell, History, Pause, Timer } from 'lucide-react';

type ShowcaseProps = { language: 'pt' | 'en' };

const COPY = {
  pt: {
    example: 'Pré-visualização · dados de exemplo', active: 'Treino ativo', name: 'Peito e tríceps',
    exercise: 'Supino (Barra)', muscle: 'Peito', set: 'Série', previous: 'Anterior',
    completed: 'Concluída', pending: 'Por concluir', sets: 'Séries feitas', volume: 'Volume',
    rest: 'Descanso', add: 'Mais exercícios no mesmo treino',
    kicker: 'A app em ação · exemplo', heading: 'A próxima série começa aqui.',
    description: 'O peso, as repetições e a última sessão. Tudo no sítio certo para continuares a evoluir.',
    points: [
      { icon: Check, title: 'Regista cada série', text: 'Peso, repetições e séries concluídas, sem sair do treino.' },
      { icon: History, title: 'Consulta o anterior', text: 'Vê o que fizeste na última sessão antes de escolheres a carga.' },
      { icon: CloudOff, title: 'Retoma o teu rascunho', text: 'O treino fica neste dispositivo. Liga-te à internet para o terminar e guardar na conta.' },
    ],
    open: 'Experimentar na app',
  },
  en: {
    example: 'Preview · sample data', active: 'Active workout', name: 'Chest and triceps',
    exercise: 'Bench Press (Barbell)', muscle: 'Chest', set: 'Set', previous: 'Previous',
    completed: 'Completed', pending: 'Pending', sets: 'Completed sets', volume: 'Volume',
    rest: 'Rest', add: 'More exercises in the same workout',
    kicker: 'The app in action · preview', heading: 'Your next set starts here.',
    description: 'Your weight, reps and last session. Everything in place to keep making progress.',
    points: [
      { icon: Check, title: 'Log every set', text: 'Weight, reps and completed sets, without leaving your workout.' },
      { icon: History, title: 'Check your previous session', text: 'See what you lifted last time before choosing your next weight.' },
      { icon: CloudOff, title: 'Resume your draft', text: 'Your workout stays on this device. Connect to finish it and save it to your account.' },
    ],
    open: 'Try the app',
  },
};

export function WorkoutPreview({ language }: ShowcaseProps) {
  const copy = COPY[language];
  const weight = language === 'pt' ? '102,5' : '102.5';

  return (
    <div className="flex h-full flex-col px-4 pb-5 pt-11 text-white">
      <div className="phone-widget flex items-center justify-between border-b border-white/10 pb-4">
        <ChevronDown className="h-5 w-5 text-white/60" aria-hidden="true" />
        <div className="flex items-center gap-1.5 font-mono text-xs tabular-nums text-white/80">
          <Pause className="h-3 w-3" aria-hidden="true" /><span>23:48</span>
        </div>
        <span className="h-2 w-2 rounded-full bg-blue-400" aria-hidden="true" />
      </div>
      <div className="phone-widget py-4">
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-[0.16em] text-blue-400">{copy.active}</p>
        <p className="text-lg font-bold tracking-tight">{copy.name}</p>
      </div>
      <div className="phone-widget mb-4 grid grid-cols-2 rounded-xl border border-white/10 bg-white/[0.03] py-2.5 text-center">
        <div className="border-r border-white/10"><p className="text-[8px] text-white/50">{copy.sets}</p><p className="mt-1 text-sm font-semibold tabular-nums">2 / 3</p></div>
        <div><p className="text-[8px] text-white/50">{copy.volume}</p><p className="mt-1 text-sm font-semibold tabular-nums">1 640 <span className="text-[9px] text-white/50">kg</span></p></div>
      </div>
      <div className="phone-widget rounded-xl border border-white/10 bg-[#141416] p-3">
        <p className="text-[12px] font-bold">{copy.exercise}</p>
        <p className="mb-3 mt-0.5 text-[9px] text-white/45">{copy.muscle}</p>
        <table className="w-full table-fixed text-center text-[10px] tabular-nums">
          <caption className="sr-only">{copy.example}: {copy.exercise}</caption>
          <thead className="text-[8px] text-white/45"><tr><th scope="col" className="w-7 pb-2">{copy.set}</th><th scope="col" className="w-[68px] pb-2">{copy.previous}</th><th scope="col" className="pb-2">kg</th><th scope="col" className="pb-2">reps</th><th scope="col" className="w-6 pb-2"><span className="sr-only">{copy.completed}</span></th></tr></thead>
          <tbody>
            {[1, 2, 3].map((set) => (
              <tr key={set} className={set < 3 ? 'bg-blue-500/[0.07]' : ''}>
                <th scope="row" className="h-9 font-medium">{set}</th>
                <td className="text-white/40">100 × 8</td>
                <td className="font-semibold">{weight}</td><td className="font-semibold">8</td>
                <td>{set < 3 ? <Check className="mx-auto h-3.5 w-3.5 text-blue-400" aria-hidden="true" /> : <span className="mx-auto block h-3 w-3 rounded border border-white/20" aria-hidden="true" />}<span className="sr-only">{set < 3 ? copy.completed : copy.pending}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="phone-widget mt-3 flex items-center justify-between rounded-xl border border-blue-400/20 bg-blue-500/10 px-3 py-3">
        <div className="flex items-center gap-2"><Timer className="h-4 w-4 text-blue-400" aria-hidden="true" /><span className="text-[10px] text-white/70">{copy.rest}</span></div>
        <span className="font-mono text-sm font-semibold tabular-nums text-blue-300">01:30</span>
      </div>
      <div className="phone-widget mt-3 flex items-center gap-2 px-1 text-[9px] text-white/40"><Dumbbell className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{copy.add}</div>
      <p className="mt-auto pt-3 text-center text-[8px] text-white/35">{copy.example}</p>
    </div>
  );
}

export function ShowcaseDescription({ language }: ShowcaseProps) {
  const copy = COPY[language];
  return (
    <div className="max-w-md text-center lg:text-left">
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-400 md:text-xs">{copy.kicker}</p>
      <h2 className="text-2xl font-bold leading-[1.08] tracking-tight text-white sm:text-3xl lg:text-5xl">{copy.heading}</h2>
      <p className="mx-auto mt-3 max-w-xs text-xs leading-relaxed text-white/55 lg:mx-0 lg:max-w-md lg:text-base">{copy.description}</p>
      <ul className="mt-7 hidden space-y-5 lg:block">
        {copy.points.map(({ icon: Icon, title, text }) => (
          <li key={title} className="flex gap-3">
            <Icon className="mt-0.5 h-4 w-4 shrink-0 text-blue-400" aria-hidden="true" />
            <div><p className="text-sm font-semibold text-white/90">{title}</p><p className="mt-1 text-xs leading-relaxed text-white/50">{text}</p></div>
          </li>
        ))}
      </ul>
      <a href="https://lyfttrack-app.vercel.app/" className="mt-6 hidden min-h-11 items-center gap-2 text-sm font-semibold text-blue-400 underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-400 lg:inline-flex">{copy.open}<span aria-hidden="true">↗</span></a>
    </div>
  );
}
