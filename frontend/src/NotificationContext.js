import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import ToastStack from "./ToastStack";

const NotificationContext = createContext({
  notify: () => {}
});

const DEFAULT_DURATION = 4500;

function NotificationProvider({ children }) {
  const [notifications, setNotifications] = useState([]);

  const removeNotification = (id) => {
    setNotifications((current) => current.filter((notification) => notification.id !== id));
  };

  const notify = ({ title, message, variant = "info", duration = DEFAULT_DURATION }) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;

    setNotifications((current) => [
      ...current,
      {
        id,
        title,
        message,
        variant,
        duration
      }
    ]);

    return id;
  };

  useEffect(() => {
    if (!notifications.length) {
      return undefined;
    }

    const timers = notifications.map((notification) =>
      setTimeout(() => {
        removeNotification(notification.id);
      }, notification.duration || DEFAULT_DURATION)
    );

    return () => {
      timers.forEach((timer) => clearTimeout(timer));
    };
  }, [notifications]);

  const value = useMemo(
    () => ({
      notify
    }),
    []
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <ToastStack notifications={notifications} onDismiss={removeNotification} />
    </NotificationContext.Provider>
  );
}

const useNotifications = () => useContext(NotificationContext);

export { NotificationProvider, useNotifications };
