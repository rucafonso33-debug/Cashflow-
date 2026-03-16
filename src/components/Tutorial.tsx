import React from 'react';
import Joyride, { Step, CallBackProps, STATUS } from 'react-joyride';

interface TutorialProps {
  run: boolean;
  onFinish: () => void;
}

export const Tutorial: React.FC<TutorialProps> = ({ run, onFinish }) => {
  const steps: Step[] = [
    {
      target: 'body',
      placement: 'center',
      content: (
        <div className="text-left">
          <h3 className="text-lg font-bold mb-2">Welcome to Provera!</h3>
          <p>Let's take a quick tour of your new financial planner.</p>
        </div>
      ),
      disableBeacon: true,
    },
    {
      target: '#current-balance-card',
      content: 'This is your current balance. You can update it anytime in the settings.',
    },
    {
      target: '#forecast-chart',
      content: 'This chart shows your projected balance for the next 12 weeks. It helps you see if you will run out of money.',
    },
    {
      target: '#weekly-timeline',
      content: 'Here you can see exactly what happens each week: incomes, expenses, and events.',
    },
    {
      target: '#simulation-button',
      content: 'Use this to simulate "What if" scenarios, like buying a new car or getting a raise.',
    },
    {
      target: '#ai-coach-button',
      content: 'Your AI Financial Coach can analyze your data and give you personalized advice.',
    },
    {
      target: '#setup-tabs',
      content: 'Switch between tabs to manage your incomes, fixed expenses, future events, and financial goals.',
    },
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    if (status === STATUS.FINISHED || status === STATUS.SKIPPED) {
      onFinish();
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#10b981',
          zIndex: 1000,
        },
      }}
    />
  );
};
