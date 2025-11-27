import React, { useEffect, useState } from 'react';
import { collection, addDoc, getDocs, query, where, orderBy, serverTimestamp, deleteDoc, doc } from 'firebase/firestore';
import { db, auth } from '../../lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { FilePlus, RefreshCw, Save } from 'lucide-react';
import LOGO from '../../../assets/logo.png';

const defaultForm = {
  header: {
    code: 'F.S.D',
    dateCreation: '18/09/2023',
    version: '00',
    dateTraitement: new Date().toLocaleDateString('fr-FR'),
    responsableTracabilite: '',
    produit: 'AVOCAT',
    conventionnel: true,
    biologique: false,
  },
  rows: Array.from({ length: 20 }, () => ({
    numeroPalette: '',
    nombreCaisses: '',
    poidsBrut: '',
    poidsNet: '',
    natureDechet: '',
    variete: ''
  }))
};

const SuiviDechets: React.FC = () => {
  const [formData, setFormData] = useState<any>(defaultForm);
  const [archivedSuivis, setArchivedSuivis] = useState<any[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('suivis_dechet_archives');
    if (saved) {
      try { setArchivedSuivis(JSON.parse(saved)); } catch { /* ignore */ }
    }

    // Wait for auth state before attempting to load remote archives — only authenticated users can read them
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) return; // not signed in
      try {
        const col = collection(db, 'suivis_dechet');
        const q = query(col, orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const remote = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) }));
        setArchivedSuivis(prev => {
          const ids = new Set(prev.map(a => a.id));
          const merged = [...prev, ...remote.filter(r => !ids.has(r.id))];
          try { localStorage.setItem('suivis_dechet_archives', JSON.stringify(merged)); } catch {};
          return merged as any[];
        });
      } catch (e) {
        console.warn('Could not load remote archives', e);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    localStorage.setItem('suivis_dechet_archives', JSON.stringify(archivedSuivis));
  }, [archivedSuivis]);

  const updateHeader = (field: string, value: any) => {
    setFormData((prev: any) => ({ ...prev, header: { ...prev.header, [field]: value } }));
  };

  // Keep dependent fields empty when palette is empty; provide defaults when filled
  const updateRow = (index: number, field: string, value: any) => {
    setFormData((prev: any) => {
      const rows = prev.rows.map((row: any, i: number) => {
        if (i !== index) return row;
        const updated = { ...row, [field]: value };

        if (field === 'numeroPalette') {
          const paletteEmpty = String(value).trim() === '';
          if (paletteEmpty) {
            updated.natureDechet = '';
            updated.variete = '';
          } else {
            if (!updated.natureDechet) updated.natureDechet = 'D,MACHINE';
            if (!updated.variete) updated.variete = 'HASS';
          }
        }

        return updated;
      });
      return { ...prev, rows };
    });
  };

  const resetForm = () => setFormData(defaultForm);

  const archiveCurrent = async () => {
    // create a temporary local archive for immediate UX
    const temp = {
      id: `arch-${Date.now()}`,
      header: { ...formData.header },
      rows: formData.rows.map((r: any) => ({ ...r })),
      archivedAt: new Date().toISOString()
    };
    setArchivedSuivis(prev => {
      const next = [temp, ...prev];
      try { localStorage.setItem('suivis_dechet_archives', JSON.stringify(next)); } catch {}
      return next;
    });
    resetForm();

    // attempt to persist to Firestore
    try {
      const payload = { header: temp.header, rows: temp.rows, archivedAt: serverTimestamp(), createdBy: auth?.currentUser?.uid || null, createdAt: serverTimestamp() };
      const col = collection(db, 'suivis_dechet');
      const docRef = await addDoc(col, payload as any);
      // replace temporary id with Firestore id in local list
      setArchivedSuivis(prev => {
        const mapped = prev.map(a => (a.archivedAt === temp.archivedAt ? { ...a, id: docRef.id } : a));
        try { localStorage.setItem('suivis_dechet_archives', JSON.stringify(mapped)); } catch {}
        return mapped;
      });
    } catch (err) {
      console.warn('Failed to save archive to Firebase', err);
    }
  };

  // Save current suivi to Firestore (also keep local archive)
  const saveToFirebase = async () => {
    try {
      const payload = {
        header: formData.header,
        rows: formData.rows,
        createdAt: serverTimestamp()
      };
      const col = collection(db, 'suivis_dechet');
      const docRef = await addDoc(col, payload as any);
      // also add to local archives list with firebase id
      const archived = { id: docRef.id, header: { ...formData.header }, rows: formData.rows.map((r: any) => ({ ...r })), archivedAt: new Date().toISOString() };
      setArchivedSuivis(prev => [archived, ...prev]);
      resetForm();
      alert('Suivi enregistré sur Firebase');
    } catch (err) {
      console.error('Firebase save failed, falling back to local storage', err);
      alert('Enregistrement Firebase impossible — sauvegarde locale effectuée');
      archiveCurrent();
    }
  };

  // Load archived suivis from Firestore and merge with local
  const syncArchivesFromFirebase = async () => {
    try {
      const col = collection(db, 'suivis_dechet');
      const q = query(col, orderBy('createdAt', 'desc'));
      const snapshot = await getDocs(q);
      const remote = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      // merge with local archived (local first)
      const merged = [...archivedSuivis, ...remote];
      setArchivedSuivis(merged as any[]);
      alert('Archives synchronisées depuis Firebase');
    } catch (err) {
      console.error('Sync from Firebase failed', err);
      alert('Impossible de synchroniser depuis Firebase');
    }
  };

  const restoreArchive = async (id: string) => {
    const item = archivedSuivis.find(a => a.id === id);
    if (!item) return;
    setFormData({ header: item.header, rows: item.rows });
    // remove from local list
    setArchivedSuivis(prev => {
      const next = prev.filter(a => a.id !== id);
      try { localStorage.setItem('suivis_dechet_archives', JSON.stringify(next)); } catch {}
      return next;
    });
    // if this was saved in Firestore, optionally delete remote doc to avoid duplicate restores
    if (id && !id.startsWith('arch-')) {
      try {
        await deleteDoc(doc(db, 'suivis_dechet', id));
      } catch (e) {
        console.warn('Failed to delete remote archive after restore', e);
      }
    }
  };

  const deleteArchive = async (id: string) => {
    if (!window.confirm('Supprimer définitivement cet archivage ?')) return;
    // if remote, delete from Firestore
    if (id && !id.startsWith('arch-')) {
      try {
        await deleteDoc(doc(db, 'suivis_dechet', id));
      } catch (e) {
        console.warn('Failed to delete remote archive', e);
        alert('Impossible de supprimer depuis Firebase');
        return;
      }
    }
    setArchivedSuivis(prev => {
      const next = prev.filter(a => a.id !== id);
      try { localStorage.setItem('suivis_dechet_archives', JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const generatePDF = async () => {
    try {
      const jsPDFModule = await import('jspdf');
      // support different exports
      // @ts-ignore
      const jsPDF = jsPDFModule.jsPDF || jsPDFModule.default || jsPDFModule;

      const imageToDataUrl = (src: string): Promise<string> => {
        return new Promise((resolve, reject) => {
          if (!src) return reject(new Error('No image source'));
          const img = new Image();
          img.crossOrigin = 'Anonymous';
          img.onload = () => {
            try {
              const canvas = document.createElement('canvas');
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (!ctx) return reject(new Error('Canvas context unavailable'));
              ctx.drawImage(img, 0, 0);
              resolve(canvas.toDataURL('image/png'));
            } catch (e) {
              reject(e);
            }
          };
          img.onerror = () => reject(new Error('Failed loading image'));
          img.src = src;
        });
      };

  // force single-page portrait A4
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210; // portrait A4
  const pageHeight = 297;
      const margin = 12;
      const usableWidth = pageWidth - margin * 2;
      let cursorY = margin + 20; // initial top space for header

      // header drawing function (logo + title + metadata)
      const drawHeader = async (page: number) => {
        // draw top bar
        doc.setFillColor(37, 99, 140);
        doc.rect(0, 0, pageWidth, 28, 'F');
        // logo
        try {
          const logoData = await imageToDataUrl(LOGO as unknown as string);
          const logoW = 28;
          const logoH = 16;
          doc.addImage(logoData, 'PNG', margin, 6, logoW, logoH);
        } catch (e) {
          // ignore
        }
        doc.setTextColor(255);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Fiche Suivi Déchets', pageWidth / 2, 16, { align: 'center' });

        // metadata block
        doc.setDrawColor(200);
        doc.setFillColor(250, 250, 250);
        doc.roundedRect(margin, 32, usableWidth, 26, 2, 2, 'FD');
        doc.setTextColor(0);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'normal');
        const h = formData?.header || {};
        doc.text(`Code: ${h.code || ''}`, margin + 4, 38);
        doc.text(`Date création: ${h.dateCreation || ''}`, margin + 60, 38);
        doc.text(`Date traitement: ${h.dateTraitement || ''}`, margin + 4, 44);
        doc.text(`Responsable: ${h.responsableTracabilite || ''}`, margin + 60, 44);

        cursorY = 32 + 26 + 8; // move cursor after meta
      };

  // table configuration (percentages) - tuned for portrait
  const colPerc = [0.14, 0.14, 0.14, 0.14, 0.34, 0.1];
      const colWidths = colPerc.map(p => Math.round(usableWidth * p));
      // adjust last column to fill remaining
      const totalCols = colWidths.reduce((s, v) => s + v, 0);
      if (totalCols < usableWidth) colWidths[colWidths.length - 1] += (usableWidth - totalCols);

      const headers = ['N° palette', 'Nombre caisses', 'Poids Brut', 'Poids Net', 'Nature de déchet', 'Variété'];

      const drawTableHeader = () => {
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(20, 60, 80);
        let x = margin;
        const h = 8;
        for (let i = 0; i < headers.length; i++) {
          doc.setFillColor(235, 245, 250);
          doc.rect(x, cursorY, colWidths[i], h, 'FD');
          doc.text(headers[i], x + 2, cursorY + 5);
          x += colWidths[i];
        }
        cursorY += 8;
      };

      const ensurePage = async () => {
        // if cursor close to bottom, add page and redraw header
        if (cursorY > pageHeight - 40) {
          // add footer page number before adding page
          const cur = doc.getNumberOfPages();
          doc.setFontSize(9);
          doc.setTextColor(120);
          doc.text(`Page ${cur}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
          doc.addPage();
          cursorY = margin;
          await drawHeader(doc.getNumberOfPages());
          drawTableHeader();
        }
      };

      // Start first page header
      await drawHeader(1);
      drawTableHeader();

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);

      const rows = Array.isArray(formData?.rows) ? formData.rows : [];
      // compute how many rows will fit on one page
      const topUsed = cursorY;
      const bottomMargin = 20;
      const availableHeight = pageHeight - bottomMargin - topUsed;
      // estimate typical row height (will vary with wrapped content)
      const estimatedRowHeight = 9;
      const maxRows = Math.max(1, Math.floor(availableHeight / estimatedRowHeight));

      let printed = 0;
      for (let i = 0; i < rows.length && printed < maxRows; i++) {
        const row = rows[i] || {};
        const cells = [row.numeroPalette || '', row.nombreCaisses || '', row.poidsBrut || '', row.poidsNet || '', row.natureDechet || '', row.variete || ''];

        // compute required height for this row by checking wrapped lines
        let maxLines = 1;
        for (let c = 0; c < cells.length; c++) {
          const w = colWidths[c] - 4;
          const txt = String(cells[c]);
          const lines = doc.splitTextToSize(txt, w);
          if (lines.length > maxLines) maxLines = lines.length;
        }
        const lineHeight = 4.2; // mm per line
        const thisRowHeight = Math.max(7, Math.ceil(maxLines) * lineHeight + 2);

        // page break if not enough space
        if (cursorY + thisRowHeight + 20 > pageHeight) {
          const cur = doc.getNumberOfPages();
          doc.setFontSize(9);
          doc.setTextColor(120);
          doc.text(`Page ${cur}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
          doc.addPage();
          cursorY = margin;
          await drawHeader(doc.getNumberOfPages());
          drawTableHeader();
        }

        // draw row background and borders
        let x = margin;
        const isAlt = i % 2 === 0;
        for (let c = 0; c < colWidths.length; c++) {
          const w = colWidths[c];
          if (isAlt) {
            doc.setFillColor(250, 250, 250);
            doc.rect(x, cursorY, w, thisRowHeight, 'F');
          }
          doc.setDrawColor(220);
          doc.rect(x, cursorY, w, thisRowHeight, 'S');
          x += w;
        }

        // write cell text
        x = margin + 2;
        for (let c = 0; c < cells.length; c++) {
          const w = colWidths[c] - 4;
          const lines = doc.splitTextToSize(String(cells[c]), w);
          doc.text(lines, x, cursorY + 4);
          x += colWidths[c];
        }

        cursorY += thisRowHeight;
        printed += 1;
      }

      // if some rows were not printed, add a small note
      if (rows.length > printed) {
        const remaining = rows.length - printed;
        doc.setFontSize(9);
        doc.setTextColor(150);
        doc.text(`... ${remaining} ligne(s) non imprimée(s)`, margin, cursorY + 6);
      }

      const fileName = `Fiche_Suivi_Dechets_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(fileName);
    } catch (err) {
      console.error('PDF generation failed', err);
      alert('Erreur lors de la génération du PDF');
    }
  };

  const saveData = () => {
    // Save locally as quick persistence; integrate with Firebase save if needed
    localStorage.setItem('suivi_dechet_current', JSON.stringify(formData));
    alert('Données sauvegardées localement');
  };

  return (
    <div className="bg-gradient-to-b from-green-50 to-white min-h-screen p-4 md:p-6">
      <div className="max-w-7xl mx-auto bg-white rounded-xl shadow-xl">
        <div className="p-6">
          {/* Header with logo section, title and document info */}
          <div className="flex mb-6 items-center">
            {/* Company logo */}
            <div className="w-24 h-16 bg-green-100 border-2 border-green-300 rounded-lg flex items-center justify-center mr-4">
              <img src={LOGO} alt="Logo" className="h-12 w-auto object-contain" />
            </div>

            {/* Main title */}
            <div className="flex-1 bg-green-600 text-white flex items-center justify-center rounded-lg mr-4">
              <h2 className="text-xl font-bold">Fiche Suivi Déchets</h2>
            </div>

            {/* Document info */}
            <div className="w-48 bg-gray-50 border-2 border-gray-300 rounded-lg p-2">
              <div className="text-sm mb-1">
                <span className="font-bold">code :</span>
                <input
                  type="text"
                  value={formData.header.code}
                  onChange={(e) => updateHeader('code', e.target.value)}
                  className="ml-2 border-0 bg-transparent focus:outline-none w-16"
                />
              </div>
              <div className="text-sm mb-1">
                <span className="font-bold">Date :</span>
                <input
                  type="text"
                  value={formData.header.dateCreation}
                  onChange={(e) => updateHeader('dateCreation', e.target.value)}
                  className="ml-2 border-0 bg-transparent focus:outline-none w-20"
                />
              </div>
              <div className="text-sm">
                <span className="font-bold">version :</span>
                <input
                  type="text"
                  value={formData.header.version}
                  onChange={(e) => updateHeader('version', e.target.value)}
                  className="ml-2 border-0 bg-transparent focus:outline-none w-8"
                />
              </div>
            </div>
          </div>

          {/* Form fields section */}
          <div className="border-2 border-gray-400 mb-4">
            {/* Date and Responsable row */}
            <div className="flex border-b border-gray-400 p-3 bg-gray-50">
              <div className="flex-1 flex items-center">
                <span className="font-bold mr-2">Date :</span>
                <input
                  type="text"
                  value={formData.header.dateTraitement}
                  onChange={(e) => updateHeader('dateTraitement', e.target.value)}
                  className="border-0 bg-transparent focus:outline-none"
                  placeholder="02/10/2023"
                />
              </div>
              <div className="flex-1 flex items-center border-l border-gray-400 pl-3">
                <span className="font-bold mr-2">Responsable Traçabilité :</span>
                <input
                  type="text"
                  value={formData.header.responsableTracabilite}
                  onChange={(e) => updateHeader('responsableTracabilite', e.target.value)}
                  className="border-0 bg-transparent focus:outline-none flex-1"
                />
              </div>
            </div>

            {/* Product and type */}
            <div className="flex p-3 bg-green-100 items-center">
              <div className="flex-1">
                <span className="font-bold mr-2">Produit :</span>
                <input
                  type="text"
                  value={formData.header.produit}
                  onChange={(e) => updateHeader('produit', e.target.value)}
                  className="border-0 bg-transparent focus:outline-none font-bold"
                />
              </div>
              <div className="flex gap-6">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.header.conventionnel}
                    onChange={(e) => updateHeader('conventionnel', e.target.checked)}
                    className="mr-2 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-sm font-medium">CONVENTIONNEL</span>
                </label>
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.header.biologique}
                    onChange={(e) => updateHeader('biologique', e.target.checked)}
                    className="mr-2 w-4 h-4 cursor-pointer"
                  />
                  <span className="text-sm font-medium">BIOLOGIQUE</span>
                </label>
              </div>
            </div>
          </div>

          {/* Table for waste data */}
          <div className="border-2 border-gray-400 mb-6 overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-green-100 border-b border-gray-400">
                  <th className="p-2 border-r border-gray-400 text-sm font-bold">N° palette</th>
                  <th className="p-2 border-r border-gray-400 text-sm font-bold">Nombre de<br/>caisses</th>
                  <th className="p-2 border-r border-gray-400 text-sm font-bold">Poids Brut</th>
                  <th className="p-2 border-r border-gray-400 text-sm font-bold">Poids Net</th>
                  <th className="p-2 border-r border-gray-400 text-sm font-bold">Nature de<br/>déchet</th>
                  <th className="p-2 text-sm font-bold">Variété</th>
                </tr>
              </thead>
              <tbody>
                {formData.rows.map((row: any, index: number) => (
                  <tr key={index} className="border-b border-gray-400 hover:bg-gray-50">
                    <td className="border-r border-gray-400">
                      <input
                        type="text"
                        value={row.numeroPalette}
                        onChange={(e) => updateRow(index, 'numeroPalette', e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && index < formData.rows.length - 1) {
                            e.preventDefault();
                            const nextInput = document.querySelector(`input[data-row="${index + 1}"][data-col="numeroPalette"]`) as HTMLInputElement;
                            if (nextInput) nextInput.focus();
                          }
                        }}
                        data-row={index}
                        data-col="numeroPalette"
                        className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-50"
                      />
                    </td>
                    <td className="border-r border-gray-400">
                      <input
                        type="text"
                        value={row.nombreCaisses}
                        onChange={(e) => updateRow(index, 'nombreCaisses', e.target.value)}
                        className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-50"
                      />
                    </td>
                    <td className="border-r border-gray-400">
                      <input
                        type="text"
                        value={row.poidsBrut}
                        onChange={(e) => updateRow(index, 'poidsBrut', e.target.value)}
                        className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-50"
                      />
                    </td>
                    <td className="border-r border-gray-400">
                      <input
                        type="text"
                        value={row.poidsNet}
                        onChange={(e) => updateRow(index, 'poidsNet', e.target.value)}
                        className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-50"
                      />
                    </td>
                    <td className="border-r border-gray-400">
                      <select
                        value={row.natureDechet}
                        onChange={(e) => updateRow(index, 'natureDechet', e.target.value)}
                        className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-50 cursor-pointer"
                        disabled={!row.numeroPalette}
                      >
                        <option value="">—</option>
                        <option value="D,MACHINE">D,MACHINE</option>
                        <option value="MALO">MALO</option>
                      </select>
                    </td>
                    <td>
                      <select
                        value={row.variete}
                        onChange={(e) => updateRow(index, 'variete', e.target.value)}
                        className="w-full p-2 border-0 text-sm text-center focus:outline-none focus:bg-blue-50 cursor-pointer"
                        disabled={!row.numeroPalette}
                      >
                        <option value="">—</option>
                        <option value="HASS">HASS</option>
                        <option value="ZUTANO">ZUTANO</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={generatePDF}
              className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-all shadow-md"
            >
              <FilePlus size={20} /> Générer PDF
            </button>
            <button
              onClick={saveToFirebase}
              className="flex items-center gap-2 bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-all shadow-md"
            >
              <Save size={20} /> Enregistrer (Firebase)
            </button>
            <button
              onClick={resetForm}
              className="flex items-center gap-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 transition-all shadow-md"
            >
              <RefreshCw size={20} /> Réinitialiser
            </button>
            <button
              onClick={archiveCurrent}
              className="flex items-center gap-2 bg-amber-500 text-white px-6 py-3 rounded-lg hover:bg-amber-600 transition-all shadow-md"
            >
              Archiver ce Suivi
            </button>
          </div>

          {/* Archive sidebar */}
          <div className="mt-6">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold mb-2">Archivés</h3>
              <div className="flex gap-2">
                <button onClick={syncArchivesFromFirebase} className="text-xs bg-sky-600 text-white px-2 py-1 rounded">Synchroniser Firebase</button>
                <button onClick={() => { const saved = localStorage.getItem('suivis_dechet_archives'); if (saved) { setArchivedSuivis(JSON.parse(saved)); } }} className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded border">Charger local</button>
              </div>
            </div>
            {archivedSuivis.length === 0 ? (
              <div className="text-sm text-gray-500">Aucun suivi archivé</div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {archivedSuivis.map(a => (
                  <div key={a.id} className="p-2 border rounded flex items-start justify-between">
                    <div>
                      <div className="font-medium text-sm">{a.header.produit} — {new Date(a.archivedAt).toLocaleString()}</div>
                      <div className="text-xs text-gray-500">Traité: {a.header.dateTraitement}</div>
                    </div>
                    <div className="flex flex-col gap-2 ml-3">
                      <button onClick={() => restoreArchive(a.id)} className="text-xs bg-emerald-600 text-white px-2 py-1 rounded">Restaurer</button>
                      <button onClick={() => deleteArchive(a.id)} className="text-xs bg-red-50 text-red-600 px-2 py-1 rounded border">Suppr.</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SuiviDechets;