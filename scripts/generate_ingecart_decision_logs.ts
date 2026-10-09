import * as fs from 'node:fs';
import * as path from 'node:path';
import * as XLSX from 'xlsx';

import { buildProjectDecisionWorkbook } from '../src/lib/projectDecisionLog.ts';

const baseProjectPath = path.join('C:\\', 'Users', 'isena', 'Documents', 'INGECART', 'PM');

type DecisionPoint = {
  id: string;
  title: string;
  description: string;
  owner: string;
  due_date: string;
  status: 'pending' | 'in_progress' | 'confirmed' | 'blocked' | 'closed';
  priority: 'critical' | 'high' | 'medium' | 'low' | 'na';
  action_taken: string;
};

type ProjectBundle = {
  folder: string;
  subfolder?: string;
  title: string;
  customer_name: string;
  project_manager: string;
  project_number: string;
  points: {
    es: DecisionPoint[];
    en: DecisionPoint[];
  };
};

const makePoint = (
  id: string,
  title: string,
  description: string,
  owner: string,
  due_date: string,
  status: DecisionPoint['status'],
  priority: DecisionPoint['priority'],
  action_taken: string,
): DecisionPoint => ({
  id,
  title,
  description,
  owner,
  due_date,
  status,
  priority,
  action_taken,
});

const projectBundles: ProjectBundle[] = [
  {
    folder: 'AUXILIAR',
    title: 'AUXILIAR',
    customer_name: 'AUXILIAR',
    project_manager: 'INGECART TEAM / Gerard',
    project_number: 'AUX-2026-01',
    points: {
      es: [
        makePoint('aux-1', 'Fuga de aceite entre unidades', 'Se detectó una fuga de aceite entre unidades. Dinglong envió una pieza correctiva el 29/09 para resolver el problema. La pieza tiene entrega prevista en Auxiliar el 06/10. Debe comprobarse que la solución elimina la fuga y se cierre el punto.', 'INGECART TEAM', '2026-10-06', 'in_progress', 'high', 'PIEZA CORRECTIVA ENTREGADA; COMPROBAR INSTALACIÓN Y CIERRE'),
        makePoint('aux-2', 'Revisión del cumplimiento contractual', 'Se acordó revisar el contrato de venta para comprobar si la máquina suministrada y configurada corresponde al alcance y condiciones pactadas.', 'INGECART TEAM', '2026-10-10', 'pending', 'high', 'CONFIRMAR RESULTADO DE LA REVISIÓN CONTRACTUAL'),
        makePoint('aux-3', 'Sensor para coated paper', 'Dinglong debía confirmar por email el plazo previsto de entrega del sensor. Aún no se tiene confirmación definitiva del proveedor.', 'INGECART TEAM', '2026-10-10', 'pending', 'critical', 'SOLICITAR CONFIRMACIÓN DE PLAZO Y ESTADO DEL SENSOR'),
        makePoint('aux-4', 'Revisión remota con Auxiliar', 'Se realizó una conexión remota con Auxiliar el 23/09. La valoración posterior fue positiva y se mantendrá el seguimiento de los puntos técnicos detectados.', 'INGECART TEAM', '2026-09-23', 'confirmed', 'na', 'CONEXIÓN REMOTA REALIZADA Y SEGUIMIENTO MANTENIDO'),
      ],
      en: [
        makePoint('aux-1-en', 'Oil leak between units', 'An oil leak between the units was detected. Dinglong sent a corrective part on 29/09 to resolve the issue. The part is expected to be delivered in Auxiliar on 06/10. It must be confirmed that the solution removes the leak and closes the point.', 'INGECART TEAM', '2026-10-06', 'in_progress', 'high', 'CORRECTIVE PART DELIVERED; VERIFY INSTALLATION AND CLOSE'),
        makePoint('aux-2-en', 'Contract compliance review', 'It was agreed to review the sales contract to verify whether the machine supplied and configured matches the agreed scope and contractual conditions.', 'INGECART TEAM', '2026-10-10', 'pending', 'high', 'CONFIRM REVIEW OUTCOME OF CONTRACTUAL COMPLIANCE'),
        makePoint('aux-3-en', 'Coated paper sensor', 'Dinglong had to confirm by email the expected delivery time for the sensor. Final confirmation from the supplier is still pending.', 'INGECART TEAM', '2026-10-10', 'pending', 'critical', 'REQUEST DELIVERY TIME AND SENSOR STATUS CONFIRMATION'),
        makePoint('aux-4-en', 'Remote review with Auxiliar', 'A remote meeting with Auxiliar was completed on 23/09. The subsequent assessment was positive and the follow-up on the technical points detected will continue.', 'INGECART TEAM', '2026-09-23', 'confirmed', 'na', 'REMOTE REVIEW COMPLETED AND FOLLOW-UP MAINTAINED'),
      ],
    },
  },
  {
    folder: 'CARTONAJES FONT',
    subfolder: 'SISTEMA CARGA CAMIONES',
    title: 'Cartonajes Font · Sistema de carga de camiones',
    customer_name: 'Cartonajes Font',
    project_manager: 'INGECART TEAM / Gerard',
    project_number: 'CF-CARGA-2026',
    points: {
      es: [
        makePoint('cf-carga-1', 'Poner deslizamiento en la línea de carga del camión para evitar problemas con los palets', 'Se debe corregir la línea de carga del camión para evitar deslizamiento y problemas de palets durante la operación.', 'INGECART TEAM', '2026-10-15', 'pending', 'critical', 'A DEFINIR CON EL CLIENTE'),
        makePoint('cf-carga-2', 'Realizar listado mínimo de recambios', 'Debe prepararse el listado mínimo de recambios para asegurar disponibilidad operativa y mantenimiento preventivo.', 'INGECART TEAM', '2026-10-18', 'pending', 'high', 'PREPARAR LISTADO BASE DE RECAMBIO'),
        makePoint('cf-carga-3', 'Pintar el centrador de palets de la tijera hidráulica', 'Se debe pintar el centrador de palets para mejorar visibilidad, desgaste y mantenimiento.', 'INGECART TEAM', '2026-10-20', 'pending', 'medium', 'A DEFINIR CON EL CLIENTE'),
        makePoint('cf-carga-4', 'Realizar presupuesto de poner puerta automática al camión', 'Necesario cuantificar la solución para la puerta automática del camión y su integración con la carga.', 'INGECART TEAM', '2026-10-22', 'pending', 'high', 'SOLICITAR PRESUPUESTO DE EQUIPO Y INSTALACIÓN'),
        makePoint('cf-carga-5', 'Realizar presupuesto de conexión eléctrica rápida del camión', 'Se requiere presupuesto para la conexión eléctrica rápida del camión y la lógica de interconexión.', 'INGECART TEAM', '2026-10-22', 'pending', 'high', 'SOLICITAR PRESUPUESTO DE CONEXIÓN ELÉCTRICA'),
      ],
      en: [
        makePoint('cf-carga-1-en', 'Add anti-slip function to the truck loading line to avoid pallet issues', 'The truck loading line must be corrected to prevent slippage and pallet problems during operation.', 'INGECART TEAM', '2026-10-15', 'pending', 'critical', 'TO BE DEFINED WITH CUSTOMER'),
        makePoint('cf-carga-2-en', 'Prepare the minimum spare parts list', 'A minimum spare parts list must be prepared to ensure operational availability and preventive maintenance.', 'INGECART TEAM', '2026-10-18', 'pending', 'high', 'PREPARE BASE SPARE PARTS LIST'),
        makePoint('cf-carga-3-en', 'Paint the pallet centering device of the hydraulic scissors', 'The pallet centering device must be painted to improve visibility, wear and maintenance.', 'INGECART TEAM', '2026-10-20', 'pending', 'medium', 'TO BE DEFINED WITH CUSTOMER'),
        makePoint('cf-carga-4-en', 'Prepare budget for automatic truck door installation', 'A quotation is needed for the automatic truck door solution and its integration with the loading operation.', 'INGECART TEAM', '2026-10-22', 'pending', 'high', 'REQUEST QUOTATION FOR EQUIPMENT AND INSTALLATION'),
        makePoint('cf-carga-5-en', 'Prepare budget for fast electrical connection of the truck', 'A budget is required for the quick electrical connection of the truck and its interconnection logic.', 'INGECART TEAM', '2026-10-22', 'pending', 'high', 'REQUEST QUOTATION FOR ELECTRICAL CONNECTION'),
      ],
    },
  },
  {
    folder: 'MACARBOX',
    subfolder: 'PALETIZADOR JUMBO',
    title: 'Macarbox · Paletizador Jumbo',
    customer_name: 'Macarbox',
    project_manager: 'INGECART TEAM / Gerard',
    project_number: 'MB-PALET-2026',
    points: {
      es: [
        makePoint('mb-1', 'Finalizar normativa CE', 'Debe cerrarse la documentación y la ejecución técnica para finalizar la normativa CE del equipo.', 'INGECART TEAM', '2026-10-12', 'pending', 'critical', 'A ESPERA DE DOCUMENTACIÓN Y VALIDACIÓN FINAL'),
        makePoint('mb-2', 'Modificar software a doble nivel piso', 'Se requiere adaptar el software para operar en doble nivel de piso con la lógica y seguridad adecuadas.', 'INGECART TEAM', '2026-10-18', 'pending', 'critical', 'SEGUIMIENTO DE DESARROLLO DE SOFTWARE'),
        makePoint('mb-3', 'Revisar velocidad de la mesa de reenvío a 90 doble motor', 'Debe revisarse la velocidad nominal de la mesa de reenvío para el doble motor y ajustar la lógica si procede.', 'INGECART TEAM', '2026-10-20', 'pending', 'high', 'REALIZAR VALIDACIÓN TÉCNICA Y AJUSTE'),
        makePoint('mb-4', 'Revisar el mínimo de pinza cerrada: debe dar 400 mm en mecánica y digital', 'Se debe comprobar el mínimo de pinza cerrada, tanto en mecánica como en versión digital, con el valor objetivo de 400 mm.', 'INGECART TEAM', '2026-10-21', 'pending', 'critical', 'VALIDAR MÍNIMO DE PINZA CERRADA'),
        makePoint('mb-5', 'Aumento de velocidad', 'Debe analizarse y validarse el aumento de velocidad del paletizador dentro de los límites seguros.', 'INGECART TEAM', '2026-10-24', 'pending', 'high', 'VALIDAR CAPACIDAD DE VELOCIDAD'),
        makePoint('mb-6', 'Manuales de recambio e información final completa', 'Falta la información final del equipo: esquemas, manual de operación, manuales de recambio y otros documentos.', 'INGECART TEAM', '2026-10-26', 'pending', 'high', 'CONTRATARY REVISAR DOCUMENTACIÓN FINAL'),
        makePoint('mb-7', 'Listado de recambios imprescindibles', 'Debe prepararse el listado mínimo de recambios imprescindibles para soporte y mantenimiento.', 'INGECART TEAM', '2026-10-28', 'pending', 'high', 'PREPARAR LISTADO DE RECAMBIO IMPRESCINDIBLE'),
        makePoint('mb-8', 'Estudio contrato de mantenimiento anual', 'Hay que revisar el contrato de mantenimiento anual y su alcance técnico y económico.', 'INGECART TEAM', '2026-10-30', 'pending', 'medium', 'REVISAR ALCANCE Y PRESUPUESTO DEL MANTENIMIENTO'),
      ],
      en: [
        makePoint('mb-1-en', 'Finalize CE compliance', 'The technical documentation and execution must be finalized to complete CE compliance for the equipment.', 'INGECART TEAM', '2026-10-12', 'pending', 'critical', 'WAITING FOR FINAL DOCUMENTATION AND VALIDATION'),
        makePoint('mb-2-en', 'Modify software for dual-level floor operation', 'The software must be adapted to operate on a double floor level with the required logic and safety conditions.', 'INGECART TEAM', '2026-10-18', 'pending', 'critical', 'SOFTWARE DEVELOPMENT FOLLOW-UP'),
        makePoint('mb-3-en', 'Check return-table speed at 90 with dual motor', 'The nominal speed of the return table for the dual motor must be reviewed and adjusted if required.', 'INGECART TEAM', '2026-10-20', 'pending', 'high', 'PERFORM TECHNICAL VALIDATION AND ADJUSTMENT'),
        makePoint('mb-4-en', 'Check minimum closed clamp value: 400 mm in mechanical and digital mode', 'The minimum closed clamp value must be checked in both mechanical and digital mode, with the target value of 400 mm.', 'INGECART TEAM', '2026-10-21', 'pending', 'critical', 'VALIDATE MINIMUM CLOSED CLAMP VALUE'),
        makePoint('mb-5-en', 'Increase speed', 'The increase in machine speed must be analyzed and validated within safe limits.', 'INGECART TEAM', '2026-10-24', 'pending', 'high', 'VALIDATE SPEED CAPACITY'),
        makePoint('mb-6-en', 'Spare parts manuals and complete final information', 'The final technical package is still missing: schematics, operating manual, spare parts manuals and other documents.', 'INGECART TEAM', '2026-10-26', 'pending', 'high', 'REVIEW FINAL DOCUMENTATION PACKAGE'),
        makePoint('mb-7-en', 'Essential spare parts list', 'An essential spare parts list must be prepared for support and maintenance.', 'INGECART TEAM', '2026-10-28', 'pending', 'high', 'PREPARE ESSENTIAL SPARE PARTS LIST'),
        makePoint('mb-8-en', 'Annual maintenance contract review', 'The annual maintenance contract must be reviewed in technical and commercial scope.', 'INGECART TEAM', '2026-10-30', 'pending', 'medium', 'REVIEW MAINTENANCE SCOPE AND BUDGET'),
      ],
    },
  },
  {
    folder: 'CARTONAJES FONT',
    subfolder: 'LINEA POTENCIA VAHLEY',
    title: 'Cartonajes Font · Línea Potencia Valley',
    customer_name: 'Cartonajes Font',
    project_manager: 'INGECART TEAM / Gerard',
    project_number: 'CF-VALEY-2026',
    points: {
      es: [
        makePoint('cf-valley-1', 'Coordinación previa', 'Debe cerrarse la coordinación previa entre equipos antes de la intervención para asegurar la secuencia correcta.', 'INGECART TEAM', '2026-10-11', 'pending', 'high', 'PREPARAR COORDINACIÓN PREVIA'),
        makePoint('cf-valley-2', 'Ejecución de la intervención', 'Debe planificarse y ejecutar la intervención con la secuencia, seguridad y supervisión adecuadas.', 'INGECART TEAM', '2026-10-14', 'pending', 'critical', 'PLANIFICAR EJECUCIÓN Y SEGUIMIENTO'),
      ],
      en: [
        makePoint('cf-valley-1-en', 'Pre-intervention coordination', 'The pre-intervention coordination between teams must be closed before execution to ensure the correct sequence.', 'INGECART TEAM', '2026-10-11', 'pending', 'high', 'PREPARE PRE-INTERVENTION COORDINATION'),
        makePoint('cf-valley-2-en', 'Intervention execution', 'The intervention must be planned and executed with the required sequence, safety controls and supervision.', 'INGECART TEAM', '2026-10-14', 'pending', 'critical', 'PLAN EXECUTION AND FOLLOW-UP'),
      ],
    },
  },
];

const exportProject = (bundle: ProjectBundle, language: 'es' | 'en') => {
  const targetFolder = bundle.subfolder ? path.join(baseProjectPath, bundle.folder, bundle.subfolder) : path.join(baseProjectPath, bundle.folder);
  fs.mkdirSync(targetFolder, { recursive: true });

  const projectPoints = bundle.points[language].map((point) => ({
    id: point.id,
    project_id: bundle.project_number,
    panel: 'customer_pending' as const,
    number: 0,
    title: point.title,
    description: point.description,
    owner: point.owner,
    due_date: point.due_date,
    status: point.status,
    priority: point.priority,
    action_taken: point.action_taken,
    suggested_action: '',
    suggested_content: '',
    score: 0,
    source_type: 'manual',
    source_ref: point.id,
    ai_generated: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  const workbook = buildProjectDecisionWorkbook({
    project: {
      id: bundle.project_number,
      title: bundle.title,
      project_number: bundle.project_number,
      customer_name: bundle.customer_name,
      project_manager: bundle.project_manager,
      delivery_deadline: new Date().toISOString().slice(0, 10),
      customer_requirements: '',
      dependencies: '',
    },
    points: projectPoints,
    panel: 'customer_pending',
    language,
  });

  const normalizeFileName = (value: string) => value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*·•]+/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');

  const filename = language === 'es'
    ? `Registro_Decisiones_${normalizeFileName(bundle.title)}_INGECART_ES.xlsx`
    : `Decision_Log_${normalizeFileName(bundle.title)}_INGECART_EN.xlsx`;

  XLSX.writeFile(workbook, path.join(targetFolder, filename));
  console.log(`Created ${path.join(targetFolder, filename)}`);
};

for (const bundle of projectBundles) {
  exportProject(bundle, 'es');
  exportProject(bundle, 'en');
}
