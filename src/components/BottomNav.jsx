import React from 'react';
import { IconHome2, IconCalendar, IconChecklist, IconReceipt2, IconTrophy } from '@tabler/icons-react';

export function BottomNav({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'gestion', icon: <IconHome2 size={21} />, label: 'Voyages' },
    { id: 'planning', icon: <IconCalendar size={21} />, label: 'Planning' },
    { id: 'checklist', icon: <IconChecklist size={21} />, label: 'Checklist' },
    { id: 'facturation', icon: <IconReceipt2 size={21} />, label: 'Budget' },
    { id: 'bilan', icon: <IconTrophy size={21} />, label: 'Bilan' }
  ];

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.92)',
      backdropFilter: 'blur(20px)',
      display: 'flex',
      justifyContent: 'center',
      borderTop: '1px solid #E8DFCF',
      boxShadow: '0 -8px 24px rgba(43, 36, 32, 0.05)',
      zIndex: 1000
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-around',
        width: '100%',
        maxWidth: '500px',
        padding: '10px 8px calc(10px + env(safe-area-inset-bottom, 10px)) 8px'
      }}>
        {navItems.map(item => {
          const actif = activeTab === item.id;
          return (
            <div
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '14px',
                backgroundColor: actif ? '#F1E8D8' : 'transparent',
                transition: 'background-color 0.2s'
              }}
            >
              <span style={{ color: actif ? '#B8863C' : '#B5A793', display: 'flex', transition: 'color 0.2s' }}>
                {item.icon}
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: actif ? '800' : '600',
                color: actif ? '#B8863C' : '#B5A793',
                transition: 'color 0.2s'
              }}>
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
