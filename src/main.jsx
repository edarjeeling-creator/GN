import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { SubscriptionProvider } from './context/SubscriptionContext.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { DataProvider } from './context/DataContext.jsx'
import { ChatProvider } from './context/ChatContext.jsx'
ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <SubscriptionProvider>
      <AuthProvider>
        <ChatProvider>
          <DataProvider>
            <App />
          </DataProvider>
        </ChatProvider>
      </AuthProvider>
    </SubscriptionProvider>
  </React.StrictMode>,
)
