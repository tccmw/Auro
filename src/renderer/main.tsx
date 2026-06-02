import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { registerRendererIpc } from './ipc/registerRendererIpc'
import './styles.css'

registerRendererIpc()

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
