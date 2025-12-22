const sabores = [
    { n: "4 Queijos", d: "molho, mussarela, parmesão, provolone, gorgonzola, azeitona e orégano", g: 47, b: 37 },
    { n: "5 Queijos", d: "molho, mussarela, parmesão, provolone, gorgonzola, catupiry, azeitona e orégano", g: 49, b: 39 },
    { n: "Abobrinha I", d: "molho, mussarela, abobrinha, alho frito, azeitona e orégano", g: 41, b: 34 },
    { n: "Abobrinha II", d: "molho, mussarela, abobrinha, pimenta calabresa, azeitona e orégano", g: 41, b: 34 },
    { n: "Alho", d: "molho, mussarela, alho frito, azeitona e orégano", g: 45, b: 35 },
    { n: "Aliche", d: "molho, mussarela, aliche, tomate, azeitona e orégano", g: 49, b: 39 },
    { n: "Americana", d: "molho, mussarela, lombinho, pimentão, champignon, tomate cereja, azeitona sem caroço e orégano", g: 50, b: 40 },
    { n: "Atum I", d: "molho, atum, cebola, azeitona e orégano", g: 46, b: 36 },
    { n: "Atum I (com mussarela)", d: "molho, mussarela, atum, cebola, azeitona e orégano", g: 48, b: 38 },
    { n: "Bacon", d: "molho, mussarela, bacon, azeitona e orégano", g: 44, b: 34 },
    { n: "Brócolis", d: "molho, brócolis, mussarela, bacon, azeitona e orégano", g: 47, b: 38 },
    { n: "Calabresa I", d: "molho, calabresa, tomate, cebola, azeitona e orégano", g: 38, b: 29 },
    { n: "Calabresa II", d: "molho, mussarela, calabresa, cebola, azeitona e orégano", g: 43, b: 34 },
    { n: "Frango Catupiry", d: "molho, frango, catupiry, azeitona e orégano", g: 47, b: 37 },
    { n: "Gênova", d: "molho, mussarela, provolone, presunto, molho pesto e azeitona", g: 48, b: 37 },
    { n: "Lombinho", d: "molho, mussarela, lombinho, provolone, azeitona e orégano", g: 46, b: 36 },
    { n: "Marguerita", d: "molho, mussarela, parmesão, tomate, azeitona e manjericão", g: 40, b: 30 },
    { n: "Mussarela", d: "molho, mussarela, tomate, azeitona e orégano", g: 38, b: 29 },
    { n: "Peperonni", d: "molho, mussarela, peperonni e azeitona", g: 49, b: 39 },
    { n: "Pomodoro", d: "molho, parmesão, alho frito, tomate e orégano", g: 44, b: 34 },
    { n: "Potatosa", d: "molho, batata, parmesão, calabresa, catupiry, azeitona sem caroço e orégano", g: 45, b: 35 },
    { n: "Portuguesa", d: "molho, mussarela, presunto, ovo cozido, ervilha, tomate, azeitona sem caroço e orégano", g: 50, b: 40 },
    { n: "Rúcula e Tomate Seco", d: "molho, mussarela, rúcula, tomate seco, azeitona e orégano", g: 46, b: 36 },
    { n: "Toscana", d: "molho, mussarela, linguiça calabresa moída, tomate, azeitona e orégano", g: 45, b: 35 },
    { n: "Anita e Garibaldi", d: "parmesão e goiabada", g: 45, b: 35 },
    { n: "Banana", d: "banana, açúcar, doce de leite e canela", g: 41, b: 31 }
];

const bebidas = [
    { n: "Coca-Cola 2L", d: "Refrigerante", p: 18 },
    { n: "Coca-Cola Zero 2L", d: "Refrigerante", p: 18 },
    { n: "Guaraná Kuat 2L", d: "Refrigerante", p: 12 },
    { n: "HEINEKEN", d: "Cerveja", p: 8 }
];

let catAtual = 'pizza';
let modoMeia = false;
let meiaLista = [];
let contador = 0;

function selecionar(c) {
    catAtual = c;
    document.querySelectorAll('.btn-nav').forEach(b => b.classList.remove('active'));
    document.getElementById('btn-'+c).classList.add('active');
    document.getElementById('subnav').style.display = (c==='bebidas') ? 'none' : 'flex';
    mostrar('inteira');
}

function mostrar(tipo) {
    modoMeia = (tipo === 'meia');
    document.getElementById('btn-inteira').classList.toggle('active', tipo === 'inteira');
    document.getElementById('btn-meia').classList.toggle('active', tipo === 'meia');
    const container = document.getElementById('sabores');
    container.innerHTML = '';

    const lista = (catAtual === 'bebidas') ? bebidas : sabores;

    lista.forEach(s => {
        let preco = (catAtual === 'bebidas') ? s.p : (catAtual === 'pizza' ? s.g : s.b);
        container.innerHTML += `
            <div class="item-card">
                <h3>${s.n}</h3>
                <p>${s.d}</p>
                <div class="price-row">
                    <span style="font-weight:900; font-size:1.5rem">R$ ${preco.toFixed(2)}</span>
                    <button class="btn-add" onclick="adicionar('${s.n}', ${preco})">ADD +</button>
                </div>
            </div>`;
    });
}

function adicionar(n, p) {
    const cart = document.getElementById('pedido');
    if(modoMeia && catAtual !== 'bebidas') {
        meiaLista.push({n, p});
        showCustomAlert("METADE 1/2", `Sabor: ${n}. Escolha a segunda metade.`);
        if(meiaLista.length === 2) {
            let finalP = Math.max(meiaLista[0].p, meiaLista[1].p);
            let label = catAtual === 'pizza' ? "Pizza Meia-a-meia" : (catAtual === 'broto' ? "Broto Meia-a-meia" : "Calzone Meia-a-meia");
            cart.value += `${label}: ${meiaLista[0].n} & ${meiaLista[1].n} - R$ ${finalP.toFixed(2)}\n`;
            meiaLista = [];
            confirmarItem();
        }
    } else {
        let label = catAtual === 'bebidas' ? "Bebida" : (catAtual === 'pizza' ? "Pizza Inteira" : (catAtual === 'broto' ? "Broto Inteira" : "Calzone"));
        cart.value += `${label}: ${n} - R$ ${p.toFixed(2)}\n`;
        confirmarItem();
        showCustomAlert("SUCESSO", n + " adicionado!");
    }
}

function confirmarItem() {
    contador++;
    document.getElementById('cart-count').innerText = contador;
}

function toggleCarrinho() { document.getElementById('carrinho').classList.toggle('open'); }

function mostrarDados(t) {
    document.getElementById('pedidoDetalhes').style.display = 'block';
    document.getElementById('entregaCampos').style.display = (t==='delivery') ? 'block' : 'none';
    document.getElementById('btn-retirar').classList.toggle('active', t==='retirar');
    document.getElementById('btn-delivery').classList.toggle('active', t==='delivery');
}

function mostrarTroco() {
    document.getElementById('trocoArea').style.display = (document.getElementById('pagamento').value === 'Dinheiro') ? 'block' : 'none';
}

function enviarPedido() {
    const itens = document.getElementById('pedido').value;
    const pag = document.getElementById('pagamento').value;
    if(!itens || !pag) return showCustomAlert("ATENÇÃO", "Preencha os itens e o pagamento!");

    let localMsg = "Vou Retirar no Balcão";
    if(document.getElementById('entregaCampos').style.display === 'block') {
        localMsg = `Delivery: ${document.getElementById('endereco').value} - Bairro: ${document.getElementById('bairro').value}`;
    }

    const textoFinal = `*PEDIDO VETORELLI*\n\n${itens}\n📍 ${localMsg}\n💳 Pagamento: ${pag}`;
    window.open(`https://wa.me/5511993407322?text=${encodeURIComponent(textoFinal)}`);
}

function showCustomAlert(t, m) {
    document.getElementById('custom-alert-title').innerText = t;
    document.getElementById('custom-alert-message').innerText = m;
    document.getElementById('custom-alert-overlay').style.display = 'flex';
}
function hideCustomAlert() { document.getElementById('custom-alert-overlay').style.display = 'none'; }

selecionar('pizza');
