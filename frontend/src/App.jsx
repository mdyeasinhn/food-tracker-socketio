
import './App.css'
import { useSocket } from './hooks/useSocket';

function App() {
const {socket, connected} = useSocket();

  return (
    <div>
    {`this is socekt io clinet app ${connected}`}
    {/* <h1>{`socket id: ${socket?.id}`}</h1> */}
    </div>
  )
}


export default App
