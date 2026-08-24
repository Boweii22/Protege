import {useStore} from './store';
import {Welcome} from './components/Welcome';
import {Setup} from './components/Setup';
import {Teaching} from './components/Teaching';
import {Exam} from './components/Exam';
import {Results} from './components/Results';

const views={welcome:Welcome,setup:Setup,teach:Teaching,exam:Exam,results:Results};

export function App(){
  const stage=useStore(s=>s.stage);
  const View=views[stage];
  return <div data-stage={stage}><View/></div>;
}
