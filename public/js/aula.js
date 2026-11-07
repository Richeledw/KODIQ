/**
 * @file aula.js
 * @description Lógica interactiva del Aula Virtual: marcado de lecciones, terminal y quizzes.
 */

// Toggle completado de lección
async function toggleLeccionCompletada(cursoId, leccionId) {
    try {
        const res = await fetch(`/curso/${cursoId}/leccion/${leccionId}/completar`, {
            method: 'POST',
            headers: { Accept: 'application/json' }
        });
        const data = await res.json();
        if (data.success) {
            const btn = document.getElementById('btnCompletarLeccion');
            const icon = document.getElementById('iconCheckLeccion');
            const text = document.getElementById('textCheckLeccion');

            if (data.completada) {
                btn.className = 'btn btn-sm btn-dark fw-semibold d-flex align-items-center gap-1';
                icon.className = 'fas fa-check-circle';
                text.textContent = 'Completada';
            } else {
                btn.className = 'btn btn-sm btn-outline-dark fw-semibold d-flex align-items-center gap-1';
                icon.className = 'fas fa-circle';
                text.textContent = 'Marcar como Completada';
            }

            if (data.progreso !== undefined) {
                const percentDisplay = document.getElementById('progressPercentDisplay');
                if (percentDisplay) percentDisplay.textContent = data.progreso + '%';
                const bar = document.getElementById('progressBarDisplay');
                if (bar) bar.style.width = data.progreso + '%';
            }
        }
    } catch (err) {
        console.error('Error al actualizar lección:', err);
    }
}

// Copiar código al portapapeles
function copiarCodigo() {
    const codeEl = document.getElementById('blockCodeSnippet');
    if (!codeEl) return;
    const code = codeEl.textContent;
    navigator.clipboard.writeText(code).then(() => {
        alert('¡Código copiado al portapapeles!');
    });
}

document.addEventListener('DOMContentLoaded', () => {
    // ── Terminal Interactiva Emulator ──
    const terminalForm = document.getElementById('terminalForm');
    const terminalInput = document.getElementById('terminalInput');
    const terminalOutput = document.getElementById('terminalOutput');
    const taskBadge = document.getElementById('tareasProgressBadge');

    const completedTasks = new Set();

    function checkTask(taskNum) {
        if (!completedTasks.has(taskNum)) {
            completedTasks.add(taskNum);
            const icon = document.getElementById(`task-icon-${taskNum}`);
            if (icon) {
                icon.className = 'fas fa-check-circle text-success';
            }
            if (taskBadge) {
                taskBadge.textContent = `${completedTasks.size}/3 completadas`;
                if (completedTasks.size === 3) {
                    taskBadge.className = 'badge bg-success text-white font-mono';
                    taskBadge.textContent = '¡3/3 completadas!';
                }
            }
        }
    }

    if (terminalForm && terminalInput && terminalOutput) {
        terminalForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const rawCmd = terminalInput.value.trim();
            if (!rawCmd) return;

            // Imprimir comando como texto seguro
            const cmdLine = document.createElement('div');
            cmdLine.className = 'terminal-line';
            const promptSpan = document.createElement('span');
            promptSpan.className = 'terminal-prompt';
            promptSpan.textContent = '$';
            cmdLine.appendChild(promptSpan);
            cmdLine.appendChild(document.createTextNode(` ${rawCmd}`));
            terminalOutput.appendChild(cmdLine);

            terminalInput.value = '';
            const cmd = rawCmd.toLowerCase();

            const responseLine = document.createElement('div');
            responseLine.className = 'terminal-line mb-2';

            if (cmd === 'clear') {
                terminalOutput.replaceChildren();
                return;
            } else if (cmd === 'help') {
                responseLine.innerHTML = `
                    <span class="text-warning">Comandos disponibles:</span><br>
                    - <span class="text-info">ls / dir</span>: listar archivos del workspace<br>
                    - <span class="text-info">cat &lt;archivo&gt;</span>: leer contenido del archivo<br>
                    - <span class="text-info">npm test</span>: ejecutar batería de pruebas automatizadas<br>
                    - <span class="text-info">node index.js</span>: ejecutar script Node.js<br>
                    - <span class="text-info">git status</span>: revisar estado del repositorio<br>
                    - <span class="text-info">clear</span>: limpiar terminal
                `;
            } else if (cmd === 'ls' || cmd === 'dir') {
                checkTask(1);
                responseLine.innerHTML = `
                    <span class="text-info">index.html</span>&nbsp;&nbsp;
                    <span class="text-info">styles.css</span>&nbsp;&nbsp;
                    <span class="text-info">index.js</span>&nbsp;&nbsp;
                    <span class="text-warning">package.json</span>&nbsp;&nbsp;
                    <span class="text-success">test/unit.test.js</span>
                `;
            } else if (cmd === 'npm test' || cmd === 'test') {
                checkTask(2);
                responseLine.innerHTML = `
                    <span class="text-muted">> eduplat-workspace@1.0.0 test</span><br>
                    <span class="text-success">✔ [PASS] test/unit.test.js: Arquitectura y componentes validados</span><br>
                    <span class="text-success">✔ [PASS] test/unit.test.js: Manejo de datos y tipado correcto</span><br>
                    <span class="text-success fw-bold">Test Suites: 1 passed, 1 total (2 tests passed)</span>
                `;
            } else if (cmd.startsWith('cat ')) {
                checkTask(3);
                responseLine.innerHTML = `
                    <span class="text-muted">// Contenido verificado del archivo</span><br>
                    <span class="text-success">console.log("¡Módulo cargado exitosamente en Eduplat!");</span>
                `;
            } else if (cmd.startsWith('node ') || cmd.startsWith('python ')) {
                checkTask(3);
                responseLine.innerHTML = `
                    <span class="text-success">[EJECUCIÓN EXITOSA]: Solución compilada y en ejecución.</span><br>
                    <span class="text-muted">Proceso finalizado con código de salida 0.</span>
                `;
            } else if (cmd === 'git status') {
                responseLine.innerHTML = `
                    On branch main<br>
                    Your branch is up to date with 'origin/main'.<br>
                    <span class="text-success">nothing to commit, working tree clean</span>
                `;
            } else {
                const errorSpan = document.createElement('span');
                errorSpan.className = 'text-danger';
                errorSpan.textContent = `Comando no reconocido: '${rawCmd}'. Escribe 'help' para ver la lista.`;
                responseLine.appendChild(errorSpan);
            }

            terminalOutput.appendChild(responseLine);
            terminalOutput.scrollTop = terminalOutput.scrollHeight;
        });
    }

    // ── Manejo de Quizzes ──
    const formQuiz = document.getElementById('formQuizModulo');
    if (formQuiz) {
        formQuiz.addEventListener('submit', async function (e) {
            e.preventDefault();
            const btn = document.getElementById('btnEvaluarQuiz');
            if (btn) {
                btn.disabled = true;
                btn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Evaluando...';
            }

            const respuestas = {
                0: document.querySelector('input[name="resp_0"]:checked')?.value,
                1: document.querySelector('input[name="resp_1"]:checked')?.value,
                2: document.querySelector('input[name="resp_2"]:checked')?.value
            };

            const endpointUrl = formQuiz.getAttribute('action') || formQuiz.dataset.action;

            try {
                const res = await fetch(endpointUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                    body: JSON.stringify({ respuestas })
                });
                const data = await res.json();

                if (data.success) {
                    formQuiz.classList.add('d-none');
                    const resBox = document.getElementById('resultadoQuizBox');
                    if (resBox) resBox.classList.remove('d-none');

                    const iconEl = document.getElementById('quizScoreIcon');
                    const titleEl = document.getElementById('quizScoreTitle');
                    const msgEl = document.getElementById('quizScoreMsg');
                    const feedbackEl = document.getElementById('quizDetallesFeedback');

                    if (data.aprobado) {
                        if (resBox) {
                            resBox.style.backgroundColor = '#F4F4F5';
                            resBox.style.borderColor = '#E4E4E7';
                        }
                        if (iconEl) {
                            iconEl.style.backgroundColor = '#18181B';
                            iconEl.style.color = '#FFFFFF';
                            iconEl.innerHTML = '<i class="fas fa-check-circle fs-4"></i>';
                        }
                        if (titleEl) {
                            titleEl.textContent = `Aprobado — Calificación: ${data.porcentaje}%`;
                            titleEl.className = 'fw-bold text-dark mb-0 font-heading';
                        }
                    } else {
                        if (resBox) {
                            resBox.style.backgroundColor = '#FEF2F2';
                            resBox.style.borderColor = '#FECACA';
                        }
                        if (iconEl) {
                            iconEl.style.backgroundColor = '#FEE2E2';
                            iconEl.style.color = '#B91C1C';
                            iconEl.innerHTML = '<i class="fas fa-times-circle fs-4"></i>';
                        }
                        if (titleEl) {
                            titleEl.textContent = `Requiere Repaso — Calificación: ${data.porcentaje}%`;
                            titleEl.className = 'fw-bold text-danger mb-0 font-heading';
                        }
                    }

                    if (msgEl) msgEl.textContent = data.mensaje;

                    if (feedbackEl && Array.isArray(data.detalles)) {
                        const feedbackWrap = document.createElement('div');
                        feedbackWrap.className = 'mt-3';
                        data.detalles.forEach((d, i) => {
                            const item = document.createElement('div');
                            item.className = 'p-2 mb-2 bg-white rounded border';

                            const cabecera = document.createElement('div');
                            cabecera.className = 'd-flex align-items-center gap-2';
                            const icono = document.createElement('i');
                            icono.className = `fas ${d.esCorrecta ? 'fa-check text-dark' : 'fa-times text-danger'}`;
                            const titulo = document.createElement('span');
                            titulo.className = 'fw-semibold text-dark';
                            titulo.textContent = `Pregunta ${i + 1}: ${d.esCorrecta ? 'Correcta' : 'Incorrecta'}`;
                            cabecera.appendChild(icono);
                            cabecera.appendChild(titulo);

                            const explicacion = document.createElement('div');
                            explicacion.className = 'text-muted small mt-1';
                            explicacion.textContent = d.explicacion || '';

                            item.appendChild(cabecera);
                            item.appendChild(explicacion);
                            feedbackWrap.appendChild(item);
                        });
                        feedbackEl.replaceChildren(feedbackWrap);
                    }
                }
            } catch (err) {
                console.error('Error al evaluar quiz:', err);
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.innerHTML = '<i class="fas fa-check-double me-1"></i> Evaluar Respuestas';
                }
            }
        });

        const btnReintentar = document.getElementById('btnReintentarQuiz');
        if (btnReintentar) {
            btnReintentar.addEventListener('click', function () {
                const resBox = document.getElementById('resultadoQuizBox');
                if (resBox) resBox.classList.add('d-none');
                formQuiz.classList.remove('d-none');
                formQuiz.reset();
            });
        }
    }
});
