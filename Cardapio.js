const sabores = [
    { nome: "4 Queijos", ingredientes: "Mussarela, parmesão, provolone e o legítimo gorgonzola", inteira: 47, broto: 37, categoria: "pizza" },
    { nome: "Calabresa", ingredientes: "Calabresa fatiada premium, cebola e azeitonas", inteira: 38, broto: 29, categoria: "pizza" },
    { nome: "Frango Catupiry", ingredientes: "Frango desfiado com Catupiry original", inteira: 47, broto: 37, categoria: "pizza" },
    { nome: "Portuguesa", ingredientes: "Presunto, ovos frescos, ervilha e mussarela", inteira: 50, broto: 40, categoria: "pizza" },
    { nome: "Marguerita", ingredientes: "Mussarela, tomate selecionado e manjericão fresco", inteira: 40, broto: 30, categoria: "pizza" },
    { nome: "Banana", ingredientes: "Banana fatiada, açúcar e canela em pó", inteira: 41, broto: 31, categoria: "doce" },
    { nome: "Coca-Cola 2L", ingredientes: "Gelada", preco: 18, categoria: "bebidas" },
    { nome: "Coca-Cola Zero 2L", ingredientes: "Gelada", preco: 18, categoria: "bebidas" },
    { nome: "Guaraná Kuat 2L", ingredientes: "Gelado", preco: 12, categoria: "bebidas" },
    { nome: "Heineken", ingredientes: "Long Neck", preco: 10, categoria: "bebidas" }
];

let categoriaAtual = 'pizza';
let modoMeia = false;
let selecionadosMeia = [];
let totalItens = 0;

function selecionar(cat) {
    categoriaAtual = cat;
    document.getElementById('subnav').style.display = (cat === 'pizza' || cat === 'broto') ? 'grid' : 'none';
    mostrar('inteira');
    // Scroll suave para os sabores
    window.scrollTo({ top: document.getElementById('sabores').offsetTop - 20, behavior: 'smooth' });
}

function mostrar(tipo) {
    modoMeia = (tipo === 'meia');
    const container = document.getElementById('sabores');
    container.innerHTML = '';
    
    const filtrados = sabores.filter(s => {
        if (categoriaAtual === 'calzone') return s.categoria === 'pizza';
        if (categoriaAtual === 'bebidas') return s.categoria === 'bebidas';
        return s.categoria === 'pizza' || s.categoria === 'doce';
    });

    filtrados.forEach(s => {
        let preco = (categoriaAtual === 'pizza') ? s.inteira : s.broto;
        if (categoriaAtual === 'calzone') preco = s.broto;
        if (categoriaAtual === 'bebidas') preco = s.preco;

        const card = document.createElement('div');
        card.className = 'item-card';
        card.innerHTML = `
            <h3>${s.nome}</h3>
            <p>${s.ingredientes || ''}</p>
            <div style="display:flex; justify-content:space-between; align-items:center">
                <div class="price-tag">R$ ${preco.toFixed(2)}</div>
                <button class="btn-add" onclick="adicionar('${s.nome}', ${preco})">ADICIONAR +</button>
            </div>
        `;
        container.appendChild(card);
    });
}

function adicionar(nome, preco) {
    const cart = document.getElementById('pedido');
    
    if (modoMeia && (categoriaAtual === 'pizza' || categoriaAtual === 'broto')) {
        selecionadosMeia.push({nome, preco});
        showCustomAlert("METADE 1/2", `Sabor: ${nome} selecionado. Agora escolha a outra metade.`);
        
        if (selecionadosMeia.length === 2) {
            const pFinal = Math.max(selecionadosMeia[0].preco, selecionadosMeia[1].preco);
            cart.value += `PIZZA MEIA: ${selecionadosMeia[0].nome} / ${selecionadosMeia[1].nome} - R$ ${pFinal.toFixed(2)}\n`;
            selecionadosMeia = [];
            atualizarContador();
            showCustomAlert("SUCESSO", "Pizza meia-meia adicionada!");
        }
    } else {
        const tipo = categoriaAtual.toUpperCase();
        cart.value += `${tipo}: ${nome} - R$ ${preco.toFixed(2)}\n`;
        atualizarContador();
        showCustomAlert("ADICIONADO", `${nome} já está no seu carrinho!`);
    }
}

function atualizarContador() {
    totalItens++;
    document.getElementById('cart-count').innerText = totalItens;
}

function toggleCarrinho() {
    document.getElementById('carrinho').classList.toggle('open');
}

function mostrarDados(tipo) {
    document.getElementById('pedidoDetalhes').style.display = 'block';
    document.getElementById('entregaCampos').style.display = (tipo === 'delivery') ? 'block' : 'none';
}

function mostrarTroco() {
    const p = document.getElementById('pagamento').value;
    document.getElementById('trocoArea').style.display = (p === 'Dinheiro') ? 'block' : 'none';
}

function enviarPedido() {
    const itens = document.getElementById('pedido').value;
    const pag = document.getElementById('pagamento').value;
    const local = document.getElementById('entregaCampos').style.display === 'block' ? 
                  `Entrega: ${document.getElementById('endereco').value} - ${document.getElementById('bairro').value}` : 
                  "Retirada no Balcão";

    if (!itens || !pag) return showCustomAlert("ERRO", "Preencha todos os dados antes de enviar!");

    const msg = `*NOVO PEDIDO VETORELLI*\n\n${itens}\n📍 ${local}\n💳 Pagamento: ${pag}`;
    window.open(`https://wa.me/5511993407322?text=${encodeURIComponent(msg)}`);
}

function showCustomAlert(t, m) {
    document.getElementById('custom-alert-title').innerText = t;
    document.getElementById('custom-alert-message').innerText = m;
    document.getElementById('custom-alert-overlay').style.display = 'flex';
}

function hideCustomAlert() {
    document.getElementById('custom-alert-overlay').style.display = 'none';
}
