import React from 'react';
import { IconBriefcase, IconCalendar, IconSun, IconChecklist, IconReceipt2 } from '@tabler/icons-react';

export function BottomNav({ activeTab, setActiveTab }) {
  const navItems = [
    { id: 'gestion', icon: <IconBriefcase size={24} />, label: 'Gestion' },
    { id: 'planning', icon: <IconCalendar size={24} />, label: 'Planning' },
    { id: 'jour', icon: <IconSun size={24} />, label: 'Jour' },
    { id: 'checklist', icon: <IconChecklist size={24} />, label: 'Checklist' },
    { id: 'facturation', icon: <IconReceipt2 size={24} />, label: 'Budget' }
  ];

  return (
    <div style={{
      position: 'fixed',
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: '#1C1C1E',
      display: 'flex',
      justifyContent: 'space-around',
      padding: '10px 0 20px 0',
      borderTop: '1px solid #333',
      zIndex: 1000
    }}>
      {navItems.map(item => (
        <div
          key={item.id}
          onClick={() => setActiveTab(item.id)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            color: activeTab === item.id ? '#0A84FF' : '#636366',
            cursor: 'pointer',
            transition: 'color 0.2s'
          }}
        >
          {item.icon}
          <span style={{ fontSize: '10px', marginTop: '4px', fontWeight: activeTab === item.id ? 'bold' : 'normal' }}>
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}