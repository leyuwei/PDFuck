import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { initializeInterfaceSize } from './lib/interface-size'
import './styles.css'
import './overrides.css'
import './page-manager.css'
import './typography.css'

initializeInterfaceSize()
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
