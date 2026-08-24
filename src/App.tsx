import {useStore} from './store';
import {Welcome} from './components/Welcome';
import {Setup} from './components/Setup';
import {Teaching} from './components/Teaching';
import {Exam} from './components/Exam';
import {Results} from './components/Results';
import {AuthenticationWall} from './components/AccountControl';
import {connectTokenGetter} from './auth/token';
import {useProtegeAuth} from './auth/context';
import {useEffect} from 'react';
import {LessonVault,PersistencePulse} from './components/LessonVault';
import {Dashboard} from './components/Dashboard';
import {Settings} from './components/Settings';
import {usePreferences} from './lib/preferences';
import {Account} from './components/Account';
import {Onboarding} from './components/Onboarding';
import {useState} from 'react';

const views={welcome:Welcome,dashboard:Dashboard,setup:Setup,teach:Teaching,exam:Exam,results:Results,settings:Settings,account:Account};

export function App(){
  const stage=useStore(s=>s.stage);
  const auth=useProtegeAuth();
  const [onboardingDismissed,setOnboardingDismissed]=useState(false);
  const reducedMotion=usePreferences(state=>state.reducedMotion);const highContrast=usePreferences(state=>state.highContrast);
  useEffect(()=>connectTokenGetter(auth.getToken),[auth.getToken]);
  useEffect(()=>{document.documentElement.dataset.motion=reducedMotion?'reduced':'full';document.documentElement.dataset.contrast=highContrast?'high':'standard'},[reducedMotion,highContrast]);
  const View=views[stage];
  if(stage!=='welcome'&&(!auth.configured||!auth.ready||!auth.signedIn))return <AuthenticationWall/>;
  const needsOnboarding=stage==='welcome'&&auth.signedIn&&!onboardingDismissed&&localStorage.getItem(`protege.onboarded.${auth.user?.email||'teacher'}`)!=='true';
  return <div data-stage={stage}><View/>{stage==='welcome'?<LessonVault/>:<PersistencePulse/>}{needsOnboarding?<Onboarding onDone={()=>setOnboardingDismissed(true)}/>:null}</div>;
}
