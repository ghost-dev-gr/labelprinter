// tabs.jsx
// Minimal local Tabs implementation (no external UI library) matching the shadcn/Radix Tabs API
// surface used by App.jsx: <Tabs><TabsList><TabsTrigger/></TabsList><TabsContent/></Tabs>

import React, { createContext, useContext, useState } from 'react';

const TabsContext = createContext(null);

export function Tabs({ defaultValue, value, onValueChange, className = '', children, ...props }) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeValue = value !== undefined ? value : internalValue;

  function setValue(next) {
    if (onValueChange) onValueChange(next);
    if (value === undefined) setInternalValue(next);
  }

  return (
    <TabsContext.Provider value={{ value: activeValue, setValue }}>
      <div className={className} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({ className = '', children, ...props }) {
  return (
    <div role="tablist" className={className} {...props}>
      {children}
    </div>
  );
}

export function TabsTrigger({ value, className = '', children, ...props }) {
  const ctx = useContext(TabsContext);
  const isActive = ctx?.value === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={isActive}
      data-state={isActive ? 'active' : 'inactive'}
      onClick={() => ctx?.setValue(value)}
      className={`${className} ${
        isActive ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground'
      }`}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, className = '', children, ...props }) {
  const ctx = useContext(TabsContext);
  if (ctx?.value !== value) return null;

  return (
    <div role="tabpanel" className={className} {...props}>
      {children}
    </div>
  );
}
