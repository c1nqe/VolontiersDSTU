import Modal from '../components/Modal.jsx';
import { PrivacyPolicyText } from '../components/PrivacyPolicy.jsx';
import { useStore } from '../store/StoreContext.jsx';

export default function PrivacyModal({ onClose }) {
  const store = useStore();
  return (
    <Modal
      title="Обработка персональных данных"
      icon="lock"
      size="lg"
      onClose={onClose}
      footer={<button type="button" className="btn btn-outline" onClick={onClose}>Закрыть</button>}
    >
      <div className="modal-body"><PrivacyPolicyText version={store.getPolicyVersion()} /></div>
    </Modal>
  );
}
