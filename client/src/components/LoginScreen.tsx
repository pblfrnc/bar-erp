import React, { useState, useEffect, useRef } from 'react';
import { StaffPublicUser, LoggedUser } from '../types';
import { api } from '../services/api';
import {
  Beer,
  Lock,
  Unlock,
  Key,
  Eye,
  EyeOff,
  AlertTriangle,
  Clock,
  ArrowLeft,
  ShieldAlert,
  Loader2,
  CheckCircle2,
  Delete
} from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (user: LoggedUser) => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess }) => {
  const [users, setUsers] = useState<StaffPublicUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<StaffPublicUser | null>(null);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Controle de tentativas e cooldown automático (sem travamento do sistema)
  const [lockoutSeconds, setLockoutSeconds] = useState<number>(0);
  const [currentTime, setCurrentTime] = useState(new Date());

  const passwordInputRef = useRef<HTMLInputElement>(null);

  // Atualizar relógio em tempo real
  useEffect(() => {
    const clockTimer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Timer de cooldown regressivo se houver bloqueio temporário
  useEffect(() => {
    if (lockoutSeconds <= 0) return;
    const cooldownTimer = setInterval(() => {
      setLockoutSeconds((prev) => {
        if (prev <= 1) {
          setErrorMsg(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(cooldownTimer);
  }, [lockoutSeconds]);

  // Carregar lista pública de usuários
  const loadUsers = async () => {
    try {
      setLoading(true);
      const list = await api.getStaffPublicList();
      setUsers(list);
      // Se houver apenas 1 usuário (ex: Administrador inicial), já o seleciona por padrão
      if (list.length === 1) {
        setSelectedUser(list[0]);
      }
    } catch (err) {
      console.error('Erro ao buscar colaboradores:', err);
      // Fallback: se o backend ainda estiver subindo o seed, cria um Administrador padrão na UI
      setUsers([{ id: 'admin_root', name: 'Administrador', role: 'ADMIN' }]);
      setSelectedUser({ id: 'admin_root', name: 'Administrador', role: 'ADMIN' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  // Focar no campo de senha sempre que selecionar um usuário
  useEffect(() => {
    if (selectedUser && passwordInputRef.current) {
      setTimeout(() => {
        passwordInputRef.current?.focus();
      }, 100);
    }
  }, [selectedUser]);

  const handleSelectUser = (user: StaffPublicUser) => {
    setSelectedUser(user);
    setPassword('');
    setErrorMsg(null);
  };

  const handleBackToUserList = () => {
    setSelectedUser(null);
    setPassword('');
    setErrorMsg(null);
  };

  const handlePinDigit = (digit: string) => {
    if (lockoutSeconds > 0) return;
    setPassword((prev) => prev + digit);
  };

  const handlePinBackspace = () => {
    if (lockoutSeconds > 0) return;
    setPassword((prev) => prev.slice(0, -1));
  };

  const handlePinClear = () => {
    if (lockoutSeconds > 0) return;
    setPassword('');
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedUser) return;
    if (!password.trim()) {
      setErrorMsg('Digite a senha ou PIN de acesso');
      return;
    }

    if (lockoutSeconds > 0) return;

    try {
      setSubmitting(true);
      setErrorMsg(null);

      const res = await api.loginStaff(selectedUser.id, password);
      if (res.success && res.user) {
        // Salva sessão localmente para persistir recargas de página
        localStorage.setItem('bar_logged_staff', JSON.stringify(res.user));
        onLoginSuccess(res.user);
      }
    } catch (err: any) {
      console.error('Erro no login:', err);
      if (err.lockedOut) {
        setLockoutSeconds(err.remainingSeconds || 15);
        setErrorMsg(err.message || 'Muitas tentativas. Acesso pausado temporariamente.');
      } else {
        setErrorMsg(err.message || 'Senha incorreta. Tente novamente.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formattedDate = currentTime.toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });

  const formattedTime = currentTime.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950 text-slate-100 flex flex-col justify-between overflow-y-auto selection:bg-amber-500/30">
      {/* BARRA SUPERIOR */}
      <header className="w-full max-w-6xl mx-auto px-4 py-4 sm:py-6 flex items-center justify-between border-b border-slate-800/80">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <Beer className="w-6 h-6 text-slate-950 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold tracking-tight text-white text-xl sm:text-2xl">
                Bar<span className="text-amber-500">ERP</span>
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30">
                PRO
              </span>
            </div>
            <p className="text-xs text-slate-400">Terminal Operacional & Retaguarda</p>
          </div>
        </div>

        {/* Relógio em Tempo Real */}
        <div className="hidden sm:flex flex-col items-end">
          <div className="flex items-center gap-2 font-mono text-lg font-bold text-amber-400">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>{formattedTime}</span>
          </div>
          <span className="text-xs text-slate-400 capitalize">{formattedDate}</span>
        </div>
      </header>

      {/* ÁREA CENTRAL: CONTEÚDO PRINCIPAL */}
      <main className="w-full max-w-4xl mx-auto px-4 py-6 sm:py-10 flex-1 flex flex-col items-center justify-center">
        {loading ? (
          <div className="flex flex-col items-center justify-center gap-3 py-16">
            <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
            <span className="text-sm text-slate-400 font-medium">Carregando operadores do sistema...</span>
          </div>
        ) : !selectedUser ? (
          /* PASSO 1: SELETOR DE USUÁRIO */
          <div className="w-full max-w-2xl text-center animate-in fade-in zoom-in-95 duration-200">
            <div className="mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                Quem está operando agora?
              </h2>
              <p className="text-sm text-slate-400 mt-1.5">
                Selecione seu perfil para acessar os módulos liberados para sua função.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
              {users.map((u) => {
                const initials = u.name.slice(0, 2).toUpperCase();
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => handleSelectUser(u)}
                    className="p-5 rounded-3xl bg-slate-900/90 hover:bg-slate-850 border border-slate-800 hover:border-amber-500/50 flex flex-col items-center justify-center text-center gap-3 transition-all duration-150 hover:scale-[1.02] hover:shadow-xl hover:shadow-amber-500/10 group cursor-pointer"
                  >
                    <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-slate-700 flex items-center justify-center text-amber-400 font-black text-xl shadow-inner group-hover:border-amber-500/50 group-hover:text-white transition">
                      {initials}
                    </div>
                    <div>
                      <h3 className="font-bold text-white text-base leading-tight group-hover:text-amber-400 transition">
                        {u.name}
                      </h3>
                      <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-800 text-slate-400 border border-slate-700/60">
                        {u.role}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* PASSO 2: DIGITAÇÃO DE SENHA / PIN */
          <div className="w-full max-w-md animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur">
              {/* Botão Voltar para Lista de Usuários */}
              <button
                type="button"
                onClick={handleBackToUserList}
                className="flex items-center gap-1.5 text-xs font-bold text-slate-400 hover:text-white mb-6 transition cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Trocar de Operador</span>
              </button>

              {/* Informações do Usuário Selecionado */}
              <div className="flex items-center gap-4 pb-5 border-b border-slate-800">
                <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-black text-lg">
                  {selectedUser.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <h3 className="text-xl font-black text-white">{selectedUser.name}</h3>
                  <span className="inline-block mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {selectedUser.role}
                  </span>
                </div>
              </div>

              {/* Alerta de Cooldown ou Erro */}
              {lockoutSeconds > 0 ? (
                <div className="mt-4 p-4 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center gap-3 animate-pulse">
                  <ShieldAlert className="w-6 h-6 text-amber-400 shrink-0" />
                  <div>
                    <h4 className="text-xs font-black uppercase text-amber-300">
                      Pausa de Segurança Ativa
                    </h4>
                    <p className="text-xs text-amber-200/90 mt-0.5">
                      Liberação automática em <strong className="font-mono text-sm">{lockoutSeconds}s</strong>...
                    </p>
                  </div>
                </div>
              ) : errorMsg ? (
                <div className="mt-4 p-3.5 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center gap-2.5 text-xs text-rose-300 font-medium animate-shake">
                  <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                  <span>{errorMsg}</span>
                </div>
              ) : null}

              {/* Formulário de Senha */}
              <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                <div>
                  <label
                    htmlFor="login-password-input"
                    className="block text-xs font-bold uppercase text-slate-400 mb-2 cursor-pointer"
                  >
                    Senha ou PIN de Acesso
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none">
                      <Lock className="w-5 h-5" />
                    </div>
                    <input
                      id="login-password-input"
                      ref={passwordInputRef}
                      type={showPassword ? 'text' : 'password'}
                      disabled={submitting || lockoutSeconds > 0}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Digite seu PIN ou senha..."
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3.5 pl-12 pr-12 text-white font-mono text-lg tracking-wider focus:outline-none focus:border-amber-500 transition cursor-text disabled:opacity-50"
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition cursor-pointer"
                      title={showPassword ? 'Ocultar Senha' : 'Ver Senha'}
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                {/* Teclado Numérico Virtual (PIN Pad Touch para PDV/Tablet) */}
                <div className="pt-2">
                  <div className="grid grid-cols-3 gap-2">
                    {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                      <button
                        key={num}
                        type="button"
                        disabled={submitting || lockoutSeconds > 0}
                        onClick={() => handlePinDigit(num)}
                        className="py-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-750 active:bg-amber-500 active:text-slate-950 font-mono font-black text-xl text-white border border-slate-700/50 transition cursor-pointer disabled:opacity-40"
                      >
                        {num}
                      </button>
                    ))}
                    <button
                      type="button"
                      disabled={submitting || lockoutSeconds > 0}
                      onClick={handlePinClear}
                      className="py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white font-bold text-xs uppercase border border-slate-800 transition cursor-pointer disabled:opacity-40"
                    >
                      Limpar
                    </button>
                    <button
                      type="button"
                      disabled={submitting || lockoutSeconds > 0}
                      onClick={() => handlePinDigit('0')}
                      className="py-3.5 rounded-2xl bg-slate-800/80 hover:bg-slate-750 active:bg-amber-500 active:text-slate-950 font-mono font-black text-xl text-white border border-slate-700/50 transition cursor-pointer disabled:opacity-40"
                    >
                      0
                    </button>
                    <button
                      type="button"
                      disabled={submitting || lockoutSeconds > 0}
                      onClick={handlePinBackspace}
                      className="py-3.5 rounded-2xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center border border-slate-800 transition cursor-pointer disabled:opacity-40"
                    >
                      <Delete className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                {/* Botão Entrar */}
                <button
                  type="submit"
                  disabled={submitting || lockoutSeconds > 0 || !password.trim()}
                  className="w-full py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-base rounded-2xl transition shadow-xl shadow-amber-500/20 active:scale-98 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 cursor-pointer mt-3"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      <span>Validando acesso...</span>
                    </>
                  ) : (
                    <>
                      <Unlock className="w-5 h-5 stroke-[2.5]" />
                      <span>Acessar BarERP</span>
                    </>
                  )}
                </button>
              </form>

              <div className="mt-4 pt-3 border-t border-slate-800 text-center">
                <span className="text-[11px] text-slate-500">
                  Senha inicial padrão: <strong className="text-amber-400 font-mono">1234</strong>
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* RODAPÉ */}
      <footer className="w-full max-w-6xl mx-auto px-4 py-4 text-center text-xs text-slate-600 border-t border-slate-900">
        BarERP Pro — Sistema de Controle Operacional, Fiscal e Financeiro • Conexão Local Segura
      </footer>
    </div>
  );
};
